const http = require("http");
const fs = require("fs");

var argv = require("minimist")(process.argv.slice(2));

http
  .createServer((request, response) => {
    const { url } = request;
    response.writeHeader(200, { "Content-Type": "text/html" });
    switch (url) {
      case "/project":
        response.write(fs.readFileSync("project.html"));
        response.end();
        break;
      case "/registration":
        response.write(fs.readFileSync("registration.html"));
        response.end();
        break;
      default:
        response.write(fs.readFileSync("home.html"));
        response.end();
        break;
    }
  })
  .listen(argv["port"]);
