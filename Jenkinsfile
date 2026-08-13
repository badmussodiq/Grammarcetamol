// Declarative Jenkins pipeline mirroring .github/workflows/ci-cd.yml: test everything,
// then (master only) build every image, push to both Docker Hub and GHCR, and deploy to
// the cloud server via SSH — no git on the server; it only ever runs pre-built images,
// so the compose/docker files are scp'd up fresh each deploy and deploy.sh (also scp'd)
// pulls + restarts with this build's exact commit SHA as the image tag.
//
// Requires on the Jenkins agent: Docker (with daemon access), Maven, Node 20+, OpenSSL, ssh/scp.
// Requires in Jenkins credentials store:
//   - "dockerhub-creds"  (username/password) — a Docker Hub access token works as the password
//   - "ghcr-creds"       (username/password) — GitHub username + a PAT with `write:packages`
//   - "deploy-ssh-key"   (SSH Username with private key) — its public half must be in the
//                          deploy server's ~/.ssh/authorized_keys; see README.md's
//                          "Deploying to a cloud server" section for one-time server setup
// Requires as Jenkins global/job environment variables:
//   - DEPLOY_HOST — the cloud server's hostname/IP (no default; deploy fails loudly without it)

pipeline {
    agent any

    environment {
        DOCKERHUB_REPO   = 'grammarcetamol'
        GHCR_REPO        = "ghcr.io/${env.GHCR_OWNER ?: 'grammarcetamol'}"
        IMAGE_TAG        = "${env.GIT_COMMIT ?: 'local'}"
        DEPLOY_DIR       = '/opt/grammarcetamol'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build shared-java') {
            steps {
                dir('backend/shared-java') {
                    sh 'mvn -B install -DskipTests'
                }
            }
        }

        stage('Test') {
            parallel {
                stage('auth-service') {
                    steps {
                        dir('backend/auth-service') {
                            sh '''
                                mkdir -p src/main/resources/keys
                                if [ ! -f src/main/resources/keys/private.pem ]; then
                                    openssl genrsa -out src/main/resources/keys/private.pem 2048
                                    openssl rsa -in src/main/resources/keys/private.pem -pubout -out src/main/resources/keys/public.pem
                                fi
                                mvn -B test
                            '''
                        }
                    }
                }
                stage('gateway-service') {
                    steps {
                        dir('backend/gateway-service') { sh 'mvn -B test' }
                    }
                }
                stage('course-service') {
                    steps {
                        dir('backend/course-service') { sh 'mvn -B test' }
                    }
                }
                stage('enrollment-service') {
                    steps {
                        dir('backend/enrollment-service') { sh 'mvn -B test' }
                    }
                }
                stage('review-service') {
                    steps {
                        dir('backend/review-service') { sh 'mvn -B test' }
                    }
                }
                stage('payment-service') {
                    steps {
                        dir('backend/payment-service') {
                            // npm install, not npm ci — package-lock.json is intentionally
                            // not committed (see .gitignore), and npm ci requires one to exist.
                            sh 'npm install'
                            sh 'npm run build'
                            sh 'npm test'
                        }
                    }
                }
                stage('notification-service') {
                    steps {
                        dir('backend/notification-service') {
                            // npm install, not npm ci — package-lock.json is intentionally
                            // not committed (see .gitignore), and npm ci requires one to exist.
                            sh 'npm install'
                            sh 'npm run build'
                            sh 'npm test'
                        }
                    }
                }
                stage('upload-service') {
                    steps {
                        dir('backend/upload-service') {
                            // npm install, not npm ci — package-lock.json is intentionally
                            // not committed (see .gitignore), and npm ci requires one to exist.
                            sh 'npm install'
                            sh 'npm run build'
                            sh 'npm test'
                        }
                    }
                }
                stage('student-frontend') {
                    steps {
                        // apps/utilities is a sibling project with its OWN node_modules (see
                        // its README) — student's TypeScript needs utilities' own
                        // react/@types/react reachable via Node's directory-walk resolution.
                        dir('apps/utilities') { sh 'npm install' }
                        dir('apps/student') {
                            // npm install, not npm ci — package-lock.json is intentionally
                            // not committed (see .gitignore), and npm ci requires one to exist.
                            sh 'npm install'
                            sh 'npm run build'
                            sh 'npm run test'
                        }
                    }
                }
                stage('admin-frontend') {
                    steps {
                        // Same reasoning as student-frontend above.
                        dir('apps/utilities') { sh 'npm install' }
                        dir('apps/admin') {
                            // npm install, not npm ci — package-lock.json is intentionally
                            // not committed (see .gitignore), and npm ci requires one to exist.
                            sh 'npm install'
                            sh 'npm run build'
                            sh 'npm run test'
                        }
                    }
                }
            }
        }

        stage('Build & Push Images') {
            when { branch 'master' }
            steps {
                script {
                    def images = [
                        [name: 'auth-service',         context: 'backend',                  dockerfile: 'backend/auth-service/Dockerfile'],
                        [name: 'course-service',       context: 'backend',                  dockerfile: 'backend/course-service/Dockerfile'],
                        [name: 'enrollment-service',   context: 'backend',                  dockerfile: 'backend/enrollment-service/Dockerfile'],
                        [name: 'review-service',       context: 'backend',                  dockerfile: 'backend/review-service/Dockerfile'],
                        [name: 'gateway-service',      context: 'backend',                  dockerfile: 'backend/gateway-service/Dockerfile'],
                        [name: 'payment-service',      context: 'backend/payment-service',      dockerfile: 'backend/payment-service/Dockerfile'],
                        [name: 'notification-service', context: 'backend/notification-service', dockerfile: 'backend/notification-service/Dockerfile'],
                        [name: 'upload-service',       context: 'backend/upload-service',       dockerfile: 'backend/upload-service/Dockerfile'],
                        [name: 'student-frontend',     context: 'apps',                     dockerfile: 'apps/student/Dockerfile'],
                        [name: 'admin-frontend',       context: 'apps',                     dockerfile: 'apps/admin/Dockerfile'],
                    ]

                    def builds = images.collectEntries { img ->
                        ["build-${img.name}": {
                            sh "docker build -f ${img.dockerfile} -t grammarcetamol-${img.name}:${IMAGE_TAG} ${img.context}"
                        }]
                    }
                    parallel builds
                }

                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
                    sh 'echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin'
                }
                withCredentials([usernamePassword(credentialsId: 'ghcr-creds', usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                    sh 'echo "$GH_TOKEN" | docker login ghcr.io -u "$GH_USER" --password-stdin'
                }

                script {
                    def services = ['auth-service', 'course-service', 'enrollment-service', 'review-service',
                                     'gateway-service', 'payment-service', 'notification-service', 'upload-service',
                                     'student-frontend', 'admin-frontend']
                    withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
                        services.each { svc ->
                            sh """
                                docker tag grammarcetamol-${svc}:${IMAGE_TAG} ${DH_USER}/grammarcetamol-${svc}:latest
                                docker tag grammarcetamol-${svc}:${IMAGE_TAG} ${DH_USER}/grammarcetamol-${svc}:${IMAGE_TAG}
                                docker push ${DH_USER}/grammarcetamol-${svc}:latest
                                docker push ${DH_USER}/grammarcetamol-${svc}:${IMAGE_TAG}

                                docker tag grammarcetamol-${svc}:${IMAGE_TAG} ${GHCR_REPO}/grammarcetamol-${svc}:latest
                                docker tag grammarcetamol-${svc}:${IMAGE_TAG} ${GHCR_REPO}/grammarcetamol-${svc}:${IMAGE_TAG}
                                docker push ${GHCR_REPO}/grammarcetamol-${svc}:latest
                                docker push ${GHCR_REPO}/grammarcetamol-${svc}:${IMAGE_TAG}
                            """
                        }
                    }
                }
            }
        }

        stage('Deploy') {
            when { branch 'master' }
            steps {
                // sshUserPrivateKey exposes both the key file AND the credential's own
                // username as env vars — cleaner than sshagent here since we need the
                // username explicitly for the ssh/scp target, not just agent-forwarding.
                withCredentials([sshUserPrivateKey(credentialsId: 'deploy-ssh-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER')]) {
                    // StrictHostKeyChecking=no is a simplification for a first-cut pipeline —
                    // for real production hardening, pre-seed a known_hosts entry for
                    // DEPLOY_HOST on the agent instead and drop this flag.
                    sh """
                        ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${SSH_USER}@${env.DEPLOY_HOST}" 'mkdir -p ${DEPLOY_DIR}'
                        scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no docker-compose.yml "${SSH_USER}@${env.DEPLOY_HOST}:${DEPLOY_DIR}/"
                        scp -i "${SSH_KEY}" -o StrictHostKeyChecking=no -r docker "${SSH_USER}@${env.DEPLOY_HOST}:${DEPLOY_DIR}/"
                        ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${SSH_USER}@${env.DEPLOY_HOST}" 'cd ${DEPLOY_DIR} && bash docker/scripts/deploy.sh ${IMAGE_TAG}'
                    """
                }
            }
        }
    }

    post {
        always {
            sh 'docker logout || true'
            sh 'docker logout ghcr.io || true'
        }
    }
}
