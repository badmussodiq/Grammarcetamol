# syntax=docker/dockerfile:1
# Build context: backend/ — needs shared-java as a sibling to install into the builder's
# local Maven repo first (no reactor/root pom sequences this automatically).
FROM eclipse-temurin:21-jdk AS builder

RUN apt-get update && apt-get install -y --no-install-recommends maven \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY shared-java/ shared-java/
COPY review-service/ review-service/
# One RUN, not two — a cache mount's content isn't guaranteed to carry over between
# separate RUN instructions the way a normal image layer would (each RUN's mount is only
# certain to see what earlier steps in the SAME RUN wrote to it). Installing shared-java
# and packaging the service in one shell command guarantees the install is actually visible
# to the package step, while still getting the cache-mount's whole point: persisting
# Maven's downloaded dependencies across separate `docker build` invocations (exported
# alongside the layer cache via docker/build-push-action's cache-to: type=gha in
# ci-cd.yml) — avoids tripping Maven Central's rate limit (HTTP 429) on repeated CI runs.
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -f shared-java/pom.xml install -DskipTests && \
    mvn -B -f review-service/pom.xml clean package -DskipTests

FROM eclipse-temurin:21-jre

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /build/review-service/target/*.jar app.jar

EXPOSE 9004
ENTRYPOINT ["java", "-jar", "app.jar"]
