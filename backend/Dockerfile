FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /workspace

COPY gradlew settings.gradle ./
COPY gradle ./gradle
COPY config ./config
COPY backend ./backend

RUN chmod +x gradlew \
    && ./gradlew :backend:bootJar :backend:gateway:bootJar --no-daemon

FROM eclipse-temurin:21-jre-alpine AS backend

WORKDIR /app
RUN addgroup -S finalcall && adduser -S finalcall -G finalcall
COPY --from=builder /workspace/backend/build/libs/*.jar /app/app.jar
USER finalcall
EXPOSE 8080 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

FROM eclipse-temurin:21-jre-alpine AS gateway

WORKDIR /app
RUN addgroup -S finalcall && adduser -S finalcall -G finalcall
COPY --from=builder /workspace/backend/gateway/build/libs/*.jar /app/app.jar
USER finalcall
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
