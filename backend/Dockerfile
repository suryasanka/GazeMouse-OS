# ==============================================================================
# Stage 1: Build the executable Spring Boot JAR with Eclipse Temurin JDK 26
# ==============================================================================
FROM eclipse-temurin:26-jdk AS builder

WORKDIR /workspace

# Copy Maven wrapper configuration and project descriptor for layer caching
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Pre-fetch project dependencies offline
RUN sh ./mvnw -B dependency:go-offline || true

# Copy source code and package the production executable JAR (tests run in CI)
COPY src/ ./src/
RUN sh ./mvnw -B clean package -DskipTests

# ==============================================================================
# Stage 2: Minimal, secure runtime container with Eclipse Temurin JRE 26
# ==============================================================================
FROM eclipse-temurin:26-jre

WORKDIR /app

# Run as an unprivileged system user for container security
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Copy only the compiled executable JAR from the builder stage
COPY --from=builder --chown=appuser:appuser /workspace/target/*.jar /app/app.jar

USER appuser

# Expose default HTTP port
EXPOSE 8080

# Environment variables with sensible defaults
ENV PORT=8080
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

# Execute Spring Boot using exec form so UNIX signals propagate properly for graceful shutdown
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]

