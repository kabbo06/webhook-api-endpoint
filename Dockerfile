# Use the official Nginx image from the Docker Hub
FROM nginx:latest

# Copy the HTML file to the Nginx default public directory
COPY index.html /usr/share/nginx/html/index.html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

