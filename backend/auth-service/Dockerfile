# Build context: backend/ (so this Dockerfile can be reused unmodified as a template
# alongside the shared-java-dependent services, even though auth-service itself has no
# shared-java dependency).
FROM eclipse-temurin:21-jdk AS builder

RUN apt-get update && apt-get install -y --no-install-recommends maven openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY auth-service/ .

# RSA keypair is a classpath resource baked into the jar at build time (JWT_PRIVATE_KEY_PATH
# defaults to classpath:keys/private.pem) and is gitignored, so a fresh checkout never has
# one — generate it here unless one was supplied via the build context. Only-if-absent so a
# real persisted key can still be dropped into src/main/resources/keys/ before building.
RUN mkdir -p src/main/resources/keys && \
    if [ ! -f src/main/resources/keys/private.pem ]; then \
      openssl genrsa -out src/main/resources/keys/private.pem 2048 && \
      openssl rsa -in src/main/resources/keys/private.pem -pubout -out src/main/resources/keys/public.pem; \
    fi

RUN mvn -B clean package -DskipTests

FROM eclipse-temurin:21-jre

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar

EXPOSE 9001 9091
ENTRYPOINT ["java", "-jar", "app.jar"]
