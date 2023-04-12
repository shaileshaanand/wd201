const express = require("express");
const app = express();
const { Todo, User } = require("./models");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const path = require("path");
const tinycsrf = require("tiny-csrf");

const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const LocalStrategy = require("passport-local");

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser("C$JxqKA!DexWci^%RVno$Kx*J@9MYpi9"));

app.use(
  tinycsrf("oiwdcdvjvoirejfryoeoreureoiitsfr", ["POST", "PUT", "DELETE"])
);

app.use(
  session({
    secret: "18AB2617E6FF89A93CCE4ADEB53F3",
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.use(passport.initialize());
app.use(passport.session());
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (email, password, done) => {
      User.findOne({ where: { email, password } })
        .then((user) => {
          return done(null, user);
        })
        .catch((error) => {
          return error;
        });
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("Serializing user in session", user.id);
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

app.get("/", (request, response) => {
  response.render("index");
});

app.get(
  "/todos",
  connectEnsureLogin.ensureLoggedIn({
    redirectTo: "/login",
  }),
  async (request, response) => {
    if (request.accepts("html")) {
      const [dueLater, dueToday, overdue, completed] = await Promise.all([
        Todo.dueLater(),
        Todo.dueToday(),
        Todo.overdue(),
        Todo.completed(),
      ]);
      response.render("home", {
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
  }
);

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
    const user = await User.create({ firstName, lastName, email, password });
    request.login(user, (err) => {
      if (err) {
        console.log("error in login", err);
      }
      response.redirect("/todos");
    });
  } catch (error) {
    console.error(error);
  }
});

module.exports = app;
