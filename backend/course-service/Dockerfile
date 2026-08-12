# Build context: backend/ — needs shared-java as a sibling to install into the builder's
# local Maven repo first (no reactor/root pom sequences this automatically).
FROM eclipse-temurin:21-jdk AS builder

RUN apt-get update && apt-get install -y --no-install-recommends maven \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY shared-java/ shared-java/
RUN mvn -B -f shared-java/pom.xml install -DskipTests

WORKDIR /app
COPY course-service/ .
RUN mvn -B clean package -DskipTests

FROM eclipse-temurin:21-jre

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar

EXPOSE 9002
ENTRYPOINT ["java", "-jar", "app.jar"]
