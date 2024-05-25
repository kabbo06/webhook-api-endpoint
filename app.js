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
