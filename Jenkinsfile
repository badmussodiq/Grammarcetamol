// Declarative Jenkins pipeline mirroring .github/workflows/ci-cd.yml: test everything,
// then (master only) build every image, push to Docker Hub, and deploy locally.
// Jenkins runs directly ON the cloud server (its job just listens for pushes to this
// branch), so "deploy" is a local file copy + docker compose run in the SAME workspace
// checkout — no SSH/SCP needed, unlike the GitHub Actions workflow which runs on
// GitHub-hosted runners and has to reach the server over the network.
//
// Requires on the Jenkins agent (= the deploy server itself): Docker (with daemon
// access), Maven, Node 22+ (jsdom 30.x, used by the frontend vitest suites, requires
// Node ^22.22.2 || ^24.15.0 || >=26.0.0 — on Node 20 its bundled undici throws
// "webidl.util.markAsUncloneable is not a function"), OpenSSL.
// Requires in Jenkins credentials store:
//   - "dockerhub-creds"  (username/password) — Docker Hub username (sodmod1999) + an
//                          access token as the password
//   - "prod-env-file"    (Secret file) — the full contents this server's .env should
//                          have (see .env.example for the variable list). Regenerated
//                          on the server on every deploy, not created there by hand.

pipeline {
    agent any

//    tools {
//        maven 'Maven-3.9'      // Must match the exact name you set in UI
//        nodejs 'Node22'       // Must match the exact name you set in UI
//    }

    environment {
        DOCKERHUB_REPO = 'grammarcetamol'
        IMAGE_TAG = "${env.GIT_COMMIT ?: 'local'}"
        DEPLOY_DIR = '/opt/grammarcetamol'
        TOOLS_DIR = "${env.HOME}/.jenkins-tools"
        PATH = "${env.TOOLS_DIR}/maven/bin:${env.TOOLS_DIR}/node/bin:${env.TOOLS_DIR}/docker:${env.PATH}"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
            withCredentials()
        }

        stage('Print Out') {
            withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
                sh 'echo "$DH_PASS" and password "$DH_PASS"'
            }
        }

        stage('Bootstrap Tools') {
            steps {
                sh '''
                    set -e
                    mkdir -p ${TOOLS_DIR}

                    # --- Maven 3.9.9 ---
                    if [ ! -x "${TOOLS_DIR}/maven/bin/mvn" ]; then
                        echo "Downloading Maven..."
                        mkdir -p ${TOOLS_DIR}/maven
                        curl -fsSL https://archive.apache.org/dist/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.tar.gz \
                            | tar -xzf - -C ${TOOLS_DIR}/maven --strip-components=1
                    fi

                    # --- Node 24 (LTS) — version-checked so upgrades are picked up ---
                    NODE_VERSION="v24.15.0"
                    if [ ! -x "${TOOLS_DIR}/node/bin/node" ] || [ "$(${TOOLS_DIR}/node/bin/node -v)" != "$NODE_VERSION" ]; then
                        echo "Downloading Node $NODE_VERSION..."
                        rm -rf ${TOOLS_DIR}/node
                        mkdir -p ${TOOLS_DIR}/node
                        curl -fsSL https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.gz \
                            | tar -xzf - -C ${TOOLS_DIR}/node --strip-components=1
                    fi

                    # --- Docker CLI (static binary) ---
                    if [ ! -x "${TOOLS_DIR}/docker/docker" ]; then
                        echo "Downloading Docker CLI..."
                        mkdir -p ${TOOLS_DIR}/docker
                        curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.3.1.tgz \
                            | tar -xzf - -C ${TOOLS_DIR}/docker --strip-components=1
                    fi

                    # Verify
                    echo "=== Tool versions ==="
                    mvn -v | head -1
                    node -v
                    docker --version
                '''
            }
        }

        stage('Build shared-java') {
            steps {
                dir('backend/shared-java') {
                    sh 'mvn -B install -DskipTests'
                }
            }
        }

        stage('Install utilities') {
            steps {
                dir('apps/utilities') { sh 'npm install' }
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
            when {
                expression {
                    env.GIT_BRANCH == 'origin/master' || env.BRANCH_NAME == 'master'
                }
            }
            steps {
                script {
                    def images = [
                            [name: 'auth-service', context: 'backend', dockerfile: 'backend/auth-service/Dockerfile'],
                            [name: 'course-service', context: 'backend', dockerfile: 'backend/course-service/Dockerfile'],
                            [name: 'enrollment-service', context: 'backend', dockerfile: 'backend/enrollment-service/Dockerfile'],
                            [name: 'review-service', context: 'backend', dockerfile: 'backend/review-service/Dockerfile'],
                            [name: 'gateway-service', context: 'backend', dockerfile: 'backend/gateway-service/Dockerfile'],
                            [name: 'payment-service', context: 'backend/payment-service', dockerfile: 'backend/payment-service/Dockerfile'],
                            [name: 'notification-service', context: 'backend/notification-service', dockerfile: 'backend/notification-service/Dockerfile'],
                            [name: 'upload-service', context: 'backend/upload-service', dockerfile: 'backend/upload-service/Dockerfile'],
                            [name: 'student-frontend', context: 'apps', dockerfile: 'apps/student/Dockerfile'],
                            [name: 'admin-frontend', context: 'apps', dockerfile: 'apps/admin/Dockerfile'],
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
                            """
                        }
                    }
                }
            }
        }

        stage('Deploy') {
            when {
                expression {
                    env.GIT_BRANCH == 'origin/master' || env.BRANCH_NAME == 'master'
                }
            }

            steps {
                // Jenkins IS the deploy server here — no SSH/SCP, just a local copy from
                // this build's own checkout into DEPLOY_DIR, then run deploy.sh in place.
                //
                // .env is generated from the "prod-env-file" credential on EVERY deploy,
                // not created by hand on the server — add a Jenkins "Secret file"
                // credential named prod-env-file whose content is the full .env this
                // service needs (see .env.example for the variable list).
                withCredentials([file(credentialsId: 'prod-env-file', variable: 'PROD_ENV_FILE')]) {
                    sh """
                        mkdir -p ${DEPLOY_DIR}
                        cp docker-compose.yml ${DEPLOY_DIR}/
                        cp -r docker ${DEPLOY_DIR}/
                        cp "\$PROD_ENV_FILE" ${DEPLOY_DIR}/.env
                        cd ${DEPLOY_DIR} && bash docker/scripts/deploy.sh ${IMAGE_TAG}
                    """
                }
            }
        }
    }

    post {
        always {
            sh 'docker logout || true'
        }
    }
}
