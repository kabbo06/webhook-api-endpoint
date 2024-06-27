# Building a CI/CD Pipeline with Docker Hub Webhooks and Node.js API Endpoint
In today's fast-paced software development environment, the need for efficient and automated deployment processes is more critical than ever. Continuous Integration and Continuous Deployment (CI/CD) pipelines play a vital role in achieving this goal by automating the build, test, and deployment phases of software delivery. In this article, we'll explore the implementation of a CI/CD pipeline by developing our own tools using Docker Hub webhooks and a Node.js API endpoint. By leveraging Docker Hub's webhook functionality to trigger actions upon image updates and creating a custom Node.js API server to orchestrate deployment tasks, we'll demonstrate how to streamline the deployment process, improve productivity, and ensure consistent delivery of software updates. Additionally, we'll showcase the power of building custom tools tailored to our specific needs, providing insights into the process of tool development alongside CI/CD automation. Join us on this journey as we delve into the intricacies of CI/CD automation and empower your development workflow with modern deployment practices.

![](/images/img1.png)

In this scenario, we will deploy a CI/CD pipeline where, when a developer pushes the Dockerfile of an updated application image to GitHub, the image can be built from the source code using GitHub Actions and pushed into a Docker Hub repository. Here, we have excluded this part and directly push the image to the Docker Hub registry. However, this process can be achieved easily, as already mentioned. Then, we will configure a Docker Hub repository webhook. When an image is pushed to the repository, it will trigger a webhook and make an API POST call to the API server. For this pipeline, we will create an API endpoint server using Node.js. It will run on a specific port, in this case, port 4000 at the /hook URL path. When it receives an API call from the Docker Hub webhook, it will perform deployment commands remotely. Specifically, it will execute a bash script on a remote server via SSH where our containerized application is running. This bash script will stop and remove the existing version of the image and deploy the new application by pulling the new version of the image. We will build this pipeline by following the step-by-step process outlined below. 

### Download Source Code:

```
git clone https://github.com/kabbo06/webhook-api-endpoint.git
```
```
cd webhook-api-endpoint/
```

### Run sample application using docker:
To test and demonstrate our methodology, we will deploy a sample application by creating the following:

### Dockerfile
```
# Use the official Nginx image from the Docker Hub
FROM nginx:latest

# Copy the HTML file to the Nginx default public directory
COPY index.html /usr/share/nginx/html/index.html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
```

### index.html
```
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Hello World Test</title>
</head>
<body>
    <h1>Application Version 1.0</h1>
</body>
</html>
```

Now build image and push to dockerhub repository:

```
sudo docker build -t kabbo06/hello_world_test:v1 .
```
```
sudo docker push kabbo06/hello_world_test:v1
```
In this lab environment, we will publish the image and run the application on the same server. Also, we will create and run the API server here. Execute the above application using the docker run command:
```
sudo docker run -d --name test -p 8080:80 kabbo06/hello_world_test:v1
```

### Verify that our application is running:

![](/images/img1.2.png)

### Building an API Endpoint Using Node.js:
Node.js should be installed on the API server. Please follow the steps below to build and run the API server, which will be running on port 4000 and will accept API calls at the /hook URL. A secret token is also configured in this script, which will be needed when configuring the webhook in the Docker Hub repository.

### app.js
```
var { execSync } = require("child_process");
var express = require("express");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var app = express();
const port = 4000;

// Hardcoded token
const SECRET_TOKEN = "secret-token"; // set your own secret token

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.post("/hook", (req, res) => {
  const token = req.query.token;

  if (token !== SECRET_TOKEN) {
    return res.status(403).send("Forbidden: Invalid Token");
  }

  console.log("Docker Hub triggered");

  // Log the entire payload received from Docker Hub
  console.log("Payload received:", JSON.stringify(req.body, null, 2));

  // Extract image tag from the webhook payload
  const imageTag = req.body.push_data.tag;

  if (!imageTag) {
    return res.status(400).send("Bad Request: No image tag found in the payload");
  }

  console.log(`Image tag received: ${imageTag}`);

  // Construct the command with the image tag as a parameter
  const command = `ssh -i ~/.ssh/id_rsa nroot@103.15.43.150 'bash ~/webhook-api-endpoint/script.sh ${imageTag}'`; // Replace with appropriate IP address

  try {
    const output = execSync(command); // the default is 'buffer'
    console.log(`Output:\n${output}`);
    res.status(200).send("Hook data received and script executed");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send("Error executing script");
  }
});

app.listen(port, () => {
  console.log(`API endpoint listening on port ${port}`);
});

module.exports = app;
```

```
npm init -y
npm install express cookie-parser morgan 
```
When this API endpoint receives a POST request from the Docker Hub webhook, it will run a script that we will configure next.

### script.sh
```
#!/bin/bash

# Variables
CONTAINER_NAME="test"
IMAGE_NAME="kabbo06/hello_world_test"

#SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#TAG_FILE="$SCRIPT_DIR/webhook-api-endpoint/tagfile"
TAG_FILE="~/webhook-api-endpoint/tagfile"

# Check if a tag is provided as an argument
if [ -z "$1" ]; then
  echo "No image tag provided. Exiting."
  exit 1
fi

NEW_IMAGE_TAG=$1

# Ensure the tag file exists
if [ ! -f "$TAG_FILE" ]; then
  echo "Tag file not found. Creating a new one."
  touch "$TAG_FILE"
fi

# Read the current tag from the tag file if it exists
if [ -f "$TAG_FILE" ]; then
  CURRENT_IMAGE_TAG=$(cat "$TAG_FILE")
else
  CURRENT_IMAGE_TAG=""
fi

echo "Stopping the container..."
# Stop the running container
sudo docker stop $CONTAINER_NAME

echo "Removing the container..."
# Remove the stopped container
sudo docker rm $CONTAINER_NAME

if [ -n "$CURRENT_IMAGE_TAG" ]; then
  echo "Removing the old image with tag $CURRENT_IMAGE_TAG..."
  # Remove the Docker image with the current tag
  sudo docker rmi $IMAGE_NAME:$CURRENT_IMAGE_TAG
else
  echo "No existing image tag found. Skipping image removal."
fi

echo "Pulling the latest image with tag $NEW_IMAGE_TAG..."
# Pull the new image with the specified tag
sudo docker pull $IMAGE_NAME:$NEW_IMAGE_TAG

echo "Running the new container..."
# Run the new container with the specified tag
sudo docker run -d --name $CONTAINER_NAME -p 8080:80 $IMAGE_NAME:$NEW_IMAGE_TAG

if [ $? -eq 0 ]; then
  echo "Updating the tag file with the new image tag..."
  # Update the tag file with the new image tag
  echo $NEW_IMAGE_TAG > "$TAG_FILE"
else
  echo "Failed to run the new container. Keeping the old tag."
fi

echo "Cleaning unused container images..."
# Clean unused images
sudo docker system prune --all -f

echo "Done!"
```
```
chmod +x script.sh
```
The API server will run this script via SSH remote command execution, so passwordless SSH authentication should be configured. This script can be hosted on a local or remote server where the application is running. It will stop and remove existing version of application and pull the latest build image and finally run using docker.

### Now run our API server with below command:
```
node app.js
```
![](/images/img1.3.png)

### Configuring Docker Hub Webhooks:
Now, we need to configure the webhook from Docker Hub repository settings as follows:

![](/images/img1.4.png)

Now, we will make some change to our sample application and build a new image. Afterward, we will push this image to the Docker Hub repository. At this point, Docker Hub should execute an API call to our server, triggering the automatic deployment of the new application.

### Chane the content of index.html
```
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Hello World Test</title>
</head>
<body>
    <h1>Application Version 2.0</h1>
</body>
</html>
```

Now build modified image and push to Docker Hub repository:

```
sudo docker build -t kabbo06/hello_world_test:v2 .
```
```
sudo docker push kabbo06/hello_world_test:v2
```

When new image is uploaded to the repository, it will trigger the API server.

![](/images/img1.6.png)

### Finally Verify that updated application is running:

![](/images/img1.7.png)
