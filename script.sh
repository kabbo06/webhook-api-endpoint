#!/bin/bash

# Variables
CONTAINER_NAME="test"
IMAGE_NAME="kabbo06/hello_world_test"

echo "Stopping the container..."
# Stop the running container
sudo docker stop $CONTAINER_NAME

echo "Removing the container..."
# Remove the stopped container
sudo docker rm $CONTAINER_NAME

echo "Removing the image..."
# Remove the Docker image
sudo docker rmi $IMAGE_NAME:latest

echo "Pulling the latest image..."
# Pull the latest image from the repository
sudo docker pull $IMAGE_NAME:latest

echo "Running the new container..."
# Run the new container
sudo docker run -d --name $CONTAINER_NAME -p 8080:80  $IMAGE_NAME:latest

echo "Cleaning unused container images..."
# Clean unused images
sudo docker system prune --all -f

echo "Done!"
