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
sudo docker build -t kabbo06/hello_world_test .
```
```
sudo docker push kabbo06/hello_world_test
```
In this lab environment, we will publish the image and run the application on the same server. Also, we will create and run the API server here. Execute the above application using the docker run command:
```
sudo docker run -d --name test -p 8080:80 kabbo06/hello_world_test:latest
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
const SECRET_TOKEN = 'secret-token'; // set your own secret token

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.post("/hook", (req, res) => {
  const token = req.query.token;

  if (token !== SECRET_TOKEN) {
    return res.status(403).send("Forbidden: Invalid Token");
  }

  console.log("Docker hub triggered");

  const command = `ssh -i ~/.ssh/id_rsa nroot@103.15.43.150 'bash ~/webhook-api-endpoint/script.sh'`; // Replace with appropriate IP address

  try {
    const output = execSync(command); // the default is 'buffer'
    console.log(`Output:\n${output}`);
    res.status(200).send("Hook data received");
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
```
```
chmod +x script.sh
```
The API server will run this script via SSH remote command execution, so passwordless SSH authentication should be configured. This script can be hosted on a local or remote server where the application is running.

### Now run our API server with below command:
```
node app.js
```
![](/images/img1.3.png)
