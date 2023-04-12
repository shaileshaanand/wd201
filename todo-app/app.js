const express = require("express");
const app = express();
const { Todo, User } = require("./models");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const path = require("path");
const tinycsrf = require("tiny-csrf");

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser("C$JxqKA!DexWci^%RVno$Kx*J@9MYpi9"));

app.use(
  tinycsrf("oiwdcdvjvoirejfryoeoreureoiitsfr", ["POST", "PUT", "DELETE"])
);

app.get("/", async (request, response) => {
  if (request.accepts("html")) {
    const [dueLater, dueToday, overdue, completed] = await Promise.all([
      Todo.dueLater(),
      Todo.dueToday(),
      Todo.overdue(),
      Todo.completed(),
    ]);
    response.render("index", {
      dueLater,
      dueToday,
      overdue,
      completed,
      csrfToken: request.csrfToken(),
    });
  } else {
    const todos = await Todo.getTodos();
    response.json(todos);
  }
});

app.get("/todos", async function (_, response) {
  const todos = await Todo.findAll();
  response.send(todos);
});

app.get("/todos/:id", async function (request, response) {
  try {
    const todo = await Todo.findByPk(request.params.id);
    if (todo) {
      return response.json(todo);
    }
    return response.status(404).send();
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.post("/todos", async function (request, response) {
  try {
    await Todo.addTodo(request.body);
    return response.redirect("/");
  } catch (error) {
    console.log(error);
    return response.status(422).send();
  }
});

app.put("/todos/:id/", async function (request, response) {
  try {
    const affectedCount = await Todo.setCompletionStatus(
      request.params.id,
      request.body.completed
    );
    return response.json(affectedCount === 1);
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.delete("/todos/:id", async function (request, response) {
  const deletedResultsCount = await Todo.destroy({
    where: { id: request.params.id },
  });
  response.send(deletedResultsCount === 1);
});

app.get("/signup", (request, response) =>
  response.render("signup", { csrfToken: request.csrfToken() })
);

app.post("/users", async (request, response) => {
  const { firstName, lastName, email, password } = request.body;
  try {
    const user = User.create({ firstName, lastName, email, password });
  } catch (error) {
    console.error(error);
  }
  response.redirect("/");
});

module.exports = app;
