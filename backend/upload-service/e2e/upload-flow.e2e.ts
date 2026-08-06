/**
 * End-to-end test — no automated harness like this exists anywhere else in the repo (every other
 * backend test is a unit-level *.spec.ts with a mocked pg Pool). This one is deliberately
 * different: it runs against the REAL running stack — gateway, auth-service, course-service,
 * upload-service, and a real MinIO instance — to prove the actual presigned-URL upload mechanism
 * works, not just that UploadsService's SQL-and-mocks logic is internally consistent.
 *
 * Requires the full local stack up (see root README's "Running everything locally") plus a real
 * admin login and a real published course. Run with `npm run test:e2e`.
 */
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash, randomBytes } from 'crypto';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:8080';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@grammarcetamol.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
// "Everyday Conversation Skills" — the free seeded course already used by this project's other
// live-verification passes (Task 28/29). Override via env if it's been removed from the seed data.
const COURSE_ID = process.env.E2E_COURSE_ID ?? '64e12330-9dbc-4f10-9d82-95b235978624';

const CHUNK_SIZE = 5 * 1024 * 1024;
const FILE_SIZE = 7 * 1024 * 1024; // 2 chunks: 5MB + 2MB — exercises the multi-part path, not just a single-part edge case

let failures = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    failures++;
    console.error(`✗ FAILED: ${message}`);
  } else {
    console.log(`✓ ${message}`);
  }
}

async function login(): Promise<string> {
  const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const setCookie = res.headers.get('set-cookie') ?? '';
  const accessToken = /access_token=([^;]+)/.exec(setCookie)?.[1];
  if (!accessToken) {
    throw new Error(`No access_token cookie in login response: ${setCookie}`);
  }
  return accessToken;
}

async function main() {
  console.log(`Running upload-service e2e flow against ${GATEWAY_URL}...\n`);

  const accessToken = await login();
  const authHeaders = { Cookie: `access_token=${accessToken}` };
  console.log('✓ Logged in as admin\n');

  const fileBuffer = randomBytes(FILE_SIZE);
  const checksum = createHash('sha256').update(fileBuffer).digest('hex');

  // 1. Create session
  const createRes = await fetch(`${GATEWAY_URL}/api/uploads/sessions`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseId: COURSE_ID,
      files: [{ fileName: 'e2e-test-video.mp4', fileSize: FILE_SIZE, fileType: 'video', mimeType: 'video/mp4', checksum }],
    }),
  });
  const createBody = await createRes.json();
  assert(createRes.status === 201 || createRes.status === 200, `create session responds ok (got ${createRes.status}: ${JSON.stringify(createBody)})`);
  assert(createBody.success === true, 'create session response envelope is success:true');

  const session = createBody.data.session;
  const file = createBody.data.files[0];
  assert(session.status === 'uploading', `session status is 'uploading' (got ${session.status})`);
  assert(file.chunks.length === 2, `file was split into 2 chunks for a 7MB file (got ${file.chunks.length})`);
  assert(!!file.storageMultipartId, 'file has a real multipart upload id from object storage');
  console.log('');

  // 2. Upload each chunk directly to MinIO via a presigned URL, then report completion
  for (const chunk of file.chunks as { chunkIndex: number; startByte: string; endByte: string; size: string }[]) {
    const presignRes = await fetch(
      `${GATEWAY_URL}/api/uploads/files/${file.id}/chunks/${chunk.chunkIndex}/presign`,
      { headers: authHeaders },
    );
    const presignBody = await presignRes.json();
    assert(presignRes.ok, `presign chunk ${chunk.chunkIndex} responds ok`);
    assert(typeof presignBody.data.url === 'string' && presignBody.data.url.length > 0, `chunk ${chunk.chunkIndex} got a signed PUT URL`);

    const start = Number(chunk.startByte);
    const end = Number(chunk.endByte);
    const chunkBytes = fileBuffer.subarray(start, end + 1);

    const putRes = await fetch(presignBody.data.url, { method: 'PUT', body: chunkBytes });
    assert(putRes.ok, `direct PUT of chunk ${chunk.chunkIndex} bytes to object storage succeeds (${putRes.status})`);
    const etag = putRes.headers.get('etag');
    assert(!!etag, `object storage returned an ETag for chunk ${chunk.chunkIndex}`);

    const completeChunkRes = await fetch(
      `${GATEWAY_URL}/api/uploads/files/${file.id}/chunks/${chunk.chunkIndex}/complete`,
      {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ etag }),
      },
    );
    assert(completeChunkRes.ok, `mark chunk ${chunk.chunkIndex} completed responds ok`);
  }
  console.log('');

  // 3. Complete the file — finalizes the multipart upload on object storage
  const completeFileRes = await fetch(`${GATEWAY_URL}/api/uploads/files/${file.id}/complete`, {
    method: 'POST',
    headers: authHeaders,
  });
  const completeFileBody = await completeFileRes.json();
  assert(completeFileRes.ok, `complete file responds ok (got ${JSON.stringify(completeFileBody)})`);
  assert(completeFileBody.data.status === 'completed', `file status is 'completed' (got ${completeFileBody.data.status})`);
  console.log('');

  // 4. Re-fetch the session — proves the whole session (not just the one file) converged to
  // 'completed', the way a resumed/reloaded upload page would check.
  const sessionRes = await fetch(`${GATEWAY_URL}/api/uploads/sessions/${session.id}`, { headers: authHeaders });
  const sessionBody = await sessionRes.json();
  assert(sessionBody.data.session.status === 'completed', `session status converged to 'completed' (got ${sessionBody.data.session.status})`);
  assert(sessionBody.data.session.completedFiles === 1, 'session completedFiles is 1');
  console.log('');

  // 5. Verify directly against MinIO, bypassing upload-service entirely — proves the object
  // genuinely exists in object storage with the right size, not just that our own DB believes it
  // does.
  const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9002',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'platform',
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'platform12345',
    },
  });
  const head = await s3.send(new HeadObjectCommand({ Bucket: file.storageBucket, Key: file.storagePath }));
  assert(head.ContentLength === FILE_SIZE, `object in MinIO has the correct size (expected ${FILE_SIZE}, got ${head.ContentLength})`);
  console.log('');

  console.log(failures === 0 ? `All checks passed.` : `${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('e2e run crashed:', err);
  process.exit(1);
});
