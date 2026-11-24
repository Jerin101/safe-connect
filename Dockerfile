# SafeConnect website image: nginx serving the static files in src/ (plain HTML, CSS and JavaScript, no build step).
#   docker build -t safeconnect .
#   docker run --rm -p 8080:80 safeconnect      -> http://localhost:8080/
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY src/ /usr/share/nginx/html/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1/ || exit 1
