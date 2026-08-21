# syntax=docker/dockerfile:1
# Build context: backend/
FROM eclipse-temurin:21-jdk AS builder

RUN apt-get update && apt-get install -y --no-install-recommends maven \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY gateway-service/ .
# Cache mount persists Maven's downloaded dependencies across builds (exported alongside
# the layer cache via docker/build-push-action's cache-to: type=gha in ci-cd.yml), so a
# repeat build doesn't re-hit Maven Central for the same artifacts — avoids tripping
# Central's rate limit (HTTP 429) on repeated CI runs.
RUN --mount=type=cache,target=/root/.m2 mvn -B clean package -DskipTests

FROM eclipse-temurin:21-jre

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar

EXPOSE 9000
ENTRYPOINT ["java", "-jar", "app.jar"]
