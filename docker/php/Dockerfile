FROM php:8.1-apache

RUN docker-php-ext-install mysqli pdo pdo_mysql

# sendmail relays to Words mailserver on words_network (hostname: mailserver, port 587)
RUN apt-get update && apt-get install -y \
    sendmail \
    sendmail-bin \
    && rm -rf /var/lib/apt/lists/*

RUN echo "define(\`SMART_HOST', \`mailserver')dnl" >> /etc/mail/sendmail.mc && \
    echo "define(\`RELAY_MAILER', \`relay')dnl" >> /etc/mail/sendmail.mc && \
    echo "define(\`RELAY_MAILER_ARGS', \`TCP \$h 587')dnl" >> /etc/mail/sendmail.mc && \
    echo "FEATURE(\`nocanonify', \`canonify_hosts')dnl" >> /etc/mail/sendmail.mc && \
    echo "MASQUERADE_AS(\`skifflakegames.com')dnl" >> /etc/mail/sendmail.mc && \
    echo "FEATURE(\`masquerade_envelope')dnl" >> /etc/mail/sendmail.mc && \
    echo "FEATURE(\`masquerade_entire_domain')dnl" >> /etc/mail/sendmail.mc && \
    m4 /etc/mail/sendmail.mc > /etc/mail/sendmail.cf

RUN a2enmod rewrite

WORKDIR /var/www/html

RUN sed -i 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/000-default.conf && \
    sed -i '/<\/VirtualHost>/i <Directory /var/www/html/public>\n    Options Indexes FollowSymLinks\n    AllowOverride All\n    Require all granted\n</Directory>' /etc/apache2/sites-available/000-default.conf

COPY docker/php/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["apache2-foreground"]
