FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY backend/merchant-service/pom.xml .
RUN mvn -B -ntp dependency:go-offline
COPY backend/merchant-service/src ./src
# Contract tests read repository documentation during packaging.
COPY docs /docs
COPY infrastructure/kubernetes /infrastructure/kubernetes
RUN mvn -B -ntp package

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /build/target/merchant-service-0.1.0.jar app.jar
USER app
EXPOSE 4001
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
