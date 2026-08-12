// Declarative Jenkins pipeline mirroring .github/workflows/ci-cd.yml: test everything,
// then (master only) build every image and push to both Docker Hub and GHCR. No deploy
// stage — this repo has no deploy target configured yet.
//
// Requires on the Jenkins agent: Docker (with daemon access), Maven, Node 20+, OpenSSL.
// Requires in Jenkins credentials store:
//   - "dockerhub-creds"  (username/password) — a Docker Hub access token works as the password
//   - "ghcr-creds"       (username/password) — GitHub username + a PAT with `write:packages`

pipeline {
    agent any

    environment {
        DOCKERHUB_REPO = 'grammarcetamol'
        GHCR_REPO      = "ghcr.io/${env.GHCR_OWNER ?: 'grammarcetamol'}"
        IMAGE_TAG      = "${env.GIT_COMMIT ?: 'local'}"
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
                            sh 'npm ci'
                            sh 'npm run build'
                            sh 'npm test'
                        }
                    }
                }
                stage('notification-service') {
                    steps {
                        dir('backend/notification-service') {
                            sh 'npm ci'
                            sh 'npm run build'
                            sh 'npm test'
                        }
                    }
                }
                stage('upload-service') {
                    steps {
                        dir('backend/upload-service') {
                            sh 'npm ci'
                            sh 'npm run build'
                            sh 'npm test'
                        }
                    }
                }
                stage('student-frontend') {
                    steps {
                        dir('apps/student') {
                            sh 'npm ci'
                            sh 'npm run build'
                            sh 'npm run test'
                        }
                    }
                }
                stage('admin-frontend') {
                    steps {
                        dir('apps/admin') {
                            sh 'npm ci'
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
    }

    post {
        always {
            sh 'docker logout || true'
            sh 'docker logout ghcr.io || true'
        }
    }
}
