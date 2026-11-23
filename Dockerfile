FROM php:8.4-cli-bookworm

ARG UID=1000
ARG GID=1000

# System libs + PHP extensions Laravel commonly needs
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip curl ca-certificates \
        libpq-dev libzip-dev libicu-dev \
    && docker-php-ext-install pdo_pgsql pgsql zip intl bcmath pcntl opcache \
    && rm -rf /var/lib/apt/lists/*

# Node.js (for Vite + React)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Composer + Laravel installer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_HOME=/opt/composer
RUN composer global config bin-dir /usr/local/bin \
    && composer global require laravel/installer

# Non-root user matching your WSL user
RUN groupadd -g ${GID} app \
    && useradd -m -u ${UID} -g ${GID} -s /bin/bash app \
    && mkdir -p /var/www/html \
    && chown app:app /var/www/html

USER app
WORKDIR /var/www/html
EXPOSE 8000 5173