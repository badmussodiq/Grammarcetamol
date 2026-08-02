# RSA Keys for JWT Signing

Generate RSA keys for JWT signing:

```bash
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

Place `private.pem` and `public.pem` in this directory.

**Never commit these files to git.** They are excluded via `.gitignore`.
