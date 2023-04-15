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
const flash = require("connect-flash");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

app.set("views", path.join(__dirname, "views"));

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

app.use(flash());
app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

app.use(passport.initialize());
app.use(passport.session());
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (email, password, done) => {
      User.findOne({ where: { email } })
        .then(async (user) => {
          if (!user) {
            return done(null, false, { message: "Invalid User" });
          }
          if (await bcrypt.compare(password, user.password)) {
            return done(null, user);
          }
          return done(null, false, { message: "Invalid password" });
        })
        .catch((error) => {
          return error;
        });
    }
  )
);

passport.serializeUser((user, done) => {
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
  if (request.user) {
    return response.redirect("/todos");
  }
  return response.render("index");
});

app.get(
  "/todos",
  connectEnsureLogin.ensureLoggedIn({
    redirectTo: "/login",
  }),
  async (request, response) => {
    if (request.accepts("html")) {
      const userId = request.user.id;
      const [dueLater, dueToday, overdue, completed] = await Promise.all([
        Todo.dueLater(userId),
        Todo.dueToday(userId),
        Todo.overdue(userId),
        Todo.completed(userId),
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

app.get(
  "/todos",
  connectEnsureLogin.ensureLoggedIn({
    redirectTo: "/login",
  }),
  async function (_, response) {
    const todos = await Todo.findAll();
    response.send(todos);
  }
);

app.get(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn({
    redirectTo: "/login",
  }),
  async function (request, response) {
    try {
      const todo = await Todo.findOne({
        where: { id: request.params.id, userId: request.user.id },
      });
      if (todo) {
        return response.json(todo);
      }
      return response.status(404).send();
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.post(
  "/todos",
  connectEnsureLogin.ensureLoggedIn({
    redirectTo: "/login",
  }),
  async function (request, response) {
    try {
      const { title, dueDate } = request.body;
      await Todo.addTodo({ title, dueDate, userId: request.user.id });
      return response.redirect("/todos");
    } catch (error) {
      if (error.name === "SequelizeValidationError") {
        if (error.errors[0].path === "title") {
          request.flash("error", "Title cannot be empty");
        }
        if (error.errors[0].path === "dueDate") {
          request.flash("error", "invalid Due date");
        }
        return response.redirect("/todos");
      }
      if (error.name === "SequelizeDatabaseError") {
        request.flash("error", "Invalid date format");
        return response.redirect("/todos");
      }
      return response.status(422).send();
    }
  }
);

app.put(
  "/todos/:id/",
  connectEnsureLogin.ensureLoggedIn({
    redirectTo: "/login",
  }),
  async function (request, response) {
    try {
      const affectedCount = await Todo.setCompletionStatus(
        request.params.id,
        request.user.id,
        request.body.completed
      );
      return response.json(affectedCount === 1);
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

app.delete(
  "/todos/:id",
  connectEnsureLogin.ensureLoggedIn({
    redirectTo: "/login",
  }),
  async function (request, response) {
    const deletedResultsCount = await Todo.destroy({
      where: { id: request.params.id, userId: request.user.id },
    });
    response.send(deletedResultsCount === 1);
  }
);

app.get("/signup", (request, response) =>
  response.render("signup", { csrfToken: request.csrfToken() })
);

app.post("/users", async (request, response) => {
  const { firstName, lastName, email, password } = request.body;
  try {
    if (!password) {
      request.flash("error", "Password cannot be empty");
      return response.redirect("/signup");
    }
    const user = await User.create({
      firstName,
      lastName,
      email,
      password: await bcrypt.hash(password, SALT_ROUNDS),
    });
    request.login(user, (err) => {
      if (err) {
        console.log("error in login", err);
      }
      response.redirect("/todos");
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      request.flash("error", "Email already exists");
    }
    if (error.name === "SequelizeValidationError") {
      if (error.errors[0].path === "firstName") {
        request.flash("error", "First name cannot be empty");
      }
      if (error.errors[0].path === "email") {
        request.flash("error", "Email cannot be empty");
      }
      if (error.errors[0].path === "password") {
        request.flash("error", "Password cannot be empty");
      }
    }
    return response.redirect("/signup");
  }
});

app.get("/login", (request, response) => {
  response.render("login", { csrfToken: request.csrfToken() });
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    response.redirect("/todos");
  }
);

app.get(
  "/signout",
  connectEnsureLogin.ensureLoggedIn({
    redirectTo: "/login",
  }),
  (request, response, next) => {
    request.logout(null, (err) => {
      if (err) {
        next(err);
      } else {
        response.redirect("/");
      }
    });
  }
);
module.exports = app;
