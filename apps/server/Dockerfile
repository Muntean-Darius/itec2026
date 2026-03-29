# ═══════════════════════════════════════════════════════════════════════════
# iTECify Runner Image
# Multi-language sandbox container: Python, Node, Java, Go, Rust, C/C++
# Build: docker buildx build --platform linux/amd64 -t paulsoporan/itecify-runner:latest --push .
# ═══════════════════════════════════════════════════════════════════════════

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# ── 1. Core system utilities & C/C++ build tools ──────────────────────────
RUN apt-get update && apt-get install -y \
    build-essential \
    software-properties-common \
    curl \
    wget \
    git \
    unzip \
    zip \
    jq \
    nano \
    vim \
    make \
    cmake \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# ── 2. Python 3 & Pip ─────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python-is-python3 \
    && rm -rf /var/lib/apt/lists/*

# ── 3. Java (OpenJDK 17) ──────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    && rm -rf /var/lib/apt/lists/*

# ── 4. Node.js v20 + Yarn + pnpm ──────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g yarn pnpm \
    && rm -rf /var/lib/apt/lists/*

# ── 5. Go ─────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    golang \
    && rm -rf /var/lib/apt/lists/*

# ── 6. Rust & Cargo — installed system-wide so ALL users can run cargo ────
# Install to /usr/local/cargo and /usr/local/rustup instead of ~/.cargo
# so the `itecify` sandbox user can access cargo without root privileges.
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --no-modify-path \
    && chmod -R a+rx /usr/local/cargo /usr/local/rustup

# ── Sandbox user & workspace ───────────────────────────────────────────────
RUN useradd --create-home --shell /bin/bash itecify \
    && mkdir -p /home/itecify/workspace \
    && chown -R itecify:itecify /home/itecify

WORKDIR /home/itecify/workspace

CMD ["tail", "-f", "/dev/null"]
