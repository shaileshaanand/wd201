const supertest = require("supertest");
const cheerio = require("cheerio");

const db = require("../models/index");
const { Todo, User } = require("../models");
const app = require("../app");

let _csrf, csrfCookie;

const today = () => new Date().toISOString().split("T")[0];

const randInt = (low, high) => {
  return Math.floor(Math.random() * (high - low)) + low;
};

const randomPastDate = () => {
  return new Date(new Date().setDate(new Date().getDate() - randInt(0, 200)))
    .toISOString()
    .split("T")[0];
};

const randomFutureDate = () => {
  return new Date(new Date().setDate(new Date().getDate() + randInt(1, 200)))
    .toISOString()
    .split("T")[0];
};

const makeTodo = async ({
  title,
  dueDate = null,
  completed = false,
  userId,
}) => {
  return await Todo.addTodo({
    title: title,
    dueDate: dueDate || today(),
    completed,
    userId,
  });
};

const makeUserAndCookie = async (userPayload) => {
  await client
    .post("/users")
    .set("Cookie", csrfCookie)
    .send(
      Object.entries({ ...userPayload, _csrf })
        .map(([key, value]) => `${key}=${value}`)
        .join("&")
    );
  const loginresp = await client
    .post("/session")
    .set("Cookie", csrfCookie)
    .send(
      `email=${userPayload.email}&password=${userPayload.password}&_csrf=${_csrf}`
    );
  const loginCookie = loginresp.headers["set-cookie"].filter(
    (cookie) => cookie.split("=")[0] === "connect.sid"
  )[0];
  const user = await User.findOne({ where: { email: userPayload.email } });
  return [user, loginCookie];
};

const client = supertest(app);

describe("Todo Application", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    const homeResp = await client.get("/login");
    const homepage = cheerio.load(homeResp.text);
    csrfCookie = homeResp.headers["set-cookie"].filter(
      (cookie) => cookie.split("=")[0] === "csrfToken"
    )[0];
    _csrf = homepage("input[name=_csrf]").attr("value");
  });

  beforeEach(async () => {
    // delete all tables
    await db.sequelize.sync({ force: true });
  });

  afterAll(async () => {
    try {
      await db.sequelize.sync({ force: true });
      await db.sequelize.close();
    } catch (error) {
      console.log(error);
    }
  });

  it("Should list overdue Todos", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });

    const [todo1, todo2, todo3, todo4] = await Promise.all([
      makeTodo({
        title: "Buy Milk",
        dueDate: randomPastDate(),
        userId: user.id,
      }),
      makeTodo({
        title: "Wash Clothes",
        dueDate: randomFutureDate(),
        userId: user.id,
      }),
      makeTodo({ title: "Pay bill", userId: user.id }),
      makeTodo({
        title: "Clean House",
        dueDate: randomPastDate(),
        completed: true,
        userId: user.id,
      }),
    ]);
    const homepage = cheerio.load(
      (await client.get("/todos").set("Cookie", loginCookie)).text
    );
    const overdueTodosList = homepage("#overdueTodos").text();
    const overdueCount = homepage("#count-overdue").text();
    expect(overdueCount).toBe("1");
    expect(overdueTodosList).toContain(todo1.title);
    expect(overdueTodosList).not.toContain(todo2.title);
    expect(overdueTodosList).not.toContain(todo3.title);
    expect(overdueTodosList).not.toContain(todo4.title);
  });

  it("Should list Todos due today", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const [todo1, todo2, todo3, todo4] = await Promise.all([
      makeTodo({ title: "Buy Milk", userId: user.id }),
      makeTodo({
        title: "Buy House",
        dueDate: randomFutureDate(),
        userId: user.id,
      }),
      makeTodo({
        title: "Wash Clothes",
        dueDate: randomPastDate(),
        userId: user.id,
      }),
      makeTodo({ title: "Sleep", completed: true }),
    ]);
    const homepage = cheerio.load(
      (await client.get("/todos").set("Cookie", loginCookie)).text
    );
    const dueTodayTodoList = homepage("#dueTodayTodos").text();
    const dueTodayCount = homepage("#count-due-today").text();
    expect(dueTodayCount).toBe("1");
    expect(dueTodayTodoList).toContain(todo1.title);
    expect(dueTodayTodoList).not.toContain(todo2.title);
    expect(dueTodayTodoList).not.toContain(todo3.title);
    expect(dueTodayTodoList).not.toContain(todo4.title);
  });

  it("Should list Todos due later", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const [todo1, todo2, todo3, todo4] = await Promise.all([
      makeTodo({
        title: "Wash Clothes",
        dueDate: randomFutureDate(),
        userId: user.id,
      }),
      makeTodo({ title: "Buy Clothes", userId: user.id }),
      makeTodo({
        title: "Pay Bills",
        dueDate: randomPastDate(),
        userId: user.id,
      }),
      makeTodo({
        title: "Repair car",
        dueDate: randomFutureDate(),
        completed: true,
        userId: user.id,
      }),
    ]);
    const homepage = cheerio.load(
      (await client.get("/todos").set("Cookie", loginCookie)).text
    );
    const dueLaterTodoList = homepage("#dueLaterTodos").text();
    const dueLaterCount = homepage("#count-due-later").text();
    expect(dueLaterCount).toBe("1");
    expect(dueLaterTodoList).toContain(todo1.title);
    expect(dueLaterTodoList).not.toContain(todo2.title);
    expect(dueLaterTodoList).not.toContain(todo3.title);
    expect(dueLaterTodoList).not.toContain(todo4.title);
  });

  it("Should list completed Todos", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const [todo1, todo2, todo3, todo4] = await Promise.all([
      makeTodo({
        title: "Sleep",
        dueDate: randomFutureDate(),
        completed: true,
        userId: user.id,
      }),
      makeTodo({ title: "Buy Clothes", userId: user.id }),
      makeTodo({
        title: "Wake Up",
        dueDate: randomPastDate(),
        userId: user.id,
      }),
      makeTodo({ title: "Code", dueDate: randomFutureDate(), userId: user.id }),
    ]);
    const homepage = cheerio.load(
      (await client.get("/todos").set("Cookie", loginCookie)).text
    );
    const completedTodoList = homepage("#completedTodos").text();
    const completedCount = homepage("#count-completed").text();
    expect(completedCount).toBe("1");
    expect(completedTodoList).toContain(todo1.title);
    expect(completedTodoList).not.toContain(todo2.title);
    expect(completedTodoList).not.toContain(todo3.title);
    expect(completedTodoList).not.toContain(todo4.title);
  });

  it("Should not not list todos without login", async () => {
    const response = await client.get("/todos").send();
    expect(response.status).toBe(302);
  });

  it("Should not return a todo by id without login list todos", async () => {
    const [user, _] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({
      title: "Buy Clothes",
      userId: user.id,
      dueDate: randomPastDate(),
    });
    const response = await client.get(`/todos/${todo.id}`).send();
    expect(response.status).toBe(302);
  });

  it("Should not return a todo by id if todo does not belong to user", async () => {
    // eslint-disable-next-line no-unused-vars
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({
      title: "Buy Clothes",
      userId: user.id,
      dueDate: randomPastDate(),
    });
    const [_, loginCookie2] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob2@pottermore.com",
      password: "random",
    });
    const response = await client
      .get(`/todos/${todo.id}`)
      .set("Cookie", loginCookie2)
      .send();
    expect(response.status).toBe(404);
  });

  it("Should not return a todo by id without login", async () => {
    const [user, _] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({
      title: "Buy Clothes",
      userId: user.id,
      dueDate: randomPastDate(),
    });
    const response = await client.get(`/todos/${todo.id}`).send();
    expect(response.status).toBe(302);
  });

  it("Should return a todo by id", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todoInstance = await makeTodo({
      title: "Buy Clothes",
      userId: user.id,
    });

    const response = await client
      .get(`/todos/${todoInstance.id}`)
      .set("Cookie", loginCookie);

    expect(response.status).toBe(200);

    expect(response.body.id).toBe(todoInstance.id);
    expect(response.body.title).toBe(todoInstance.title);
    expect(response.body.dueDate).toBe(todoInstance.dueDate);
  });

  it("Should not create a new todo using POST request without csrf token", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const payload = {
      title: "Watch Movie",
      dueDate: randomFutureDate(),
      userId: user.id,
    };
    const response = await client
      .post("/todos")
      .set("Cookie", loginCookie)
      .send(payload);
    expect(response.status).toBe(500);
  });

  it("Should not create a new todo using POST request without login", async () => {
    // eslint-disable-next-line no-unused-vars
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const payload = {
      title: "Watch Movie",
      dueDate: randomFutureDate(),
      userId: user.id,
      _csrf,
    };
    const response = await client
      .post("/todos")
      .set("Cookie", csrfCookie)
      .send(payload);
    expect(response.status).toBe(302);
  });

  it("Should create a new todo using POST request", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const payload = {
      title: "Goto Park",
      dueDate: randomPastDate(),
      userId: user,
      _csrf,
    };
    const response = await client
      .post("/todos")
      .set("Cookie", [csrfCookie, loginCookie])
      .send(payload);
    expect(response.status).toBe(302);
    const createdTodo = await Todo.findOne({
      order: [["id", "DESC"]],
    });
    expect(createdTodo.title).toBe(payload.title);
    expect(createdTodo.dueDate).toBe(payload.dueDate);
    expect(createdTodo.completed).toBe(false);
  });

  it("Should not a mark todo as complete without csrf token", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({ title: "Buy Clothes", userId: user.id });
    expect(todo.completed).toBe(false);

    const response = await client
      .put(`/todos/${todo.id}`)
      .set("Cookie", loginCookie)
      .send({ completed: true });
    expect(response.status).toBe(500);
    await todo.reload();
    expect(todo.completed).toBe(false);
  });

  it("Should not a mark todo as complete without login", async () => {
    const [user, _] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });

    const todo = await makeTodo({
      title: "Buy Clothes",
      userId: user.id,
    });
    expect(todo.completed).toBe(false);

    const response = await client
      .put(`/todos/${todo.id}`)
      .set("Cookie", csrfCookie)
      .send({
        completed: true,
        _csrf,
      });
    expect(response.status).toBe(302);
    await todo.reload();
    expect(todo.completed).toBe(false);
  });

  it("Should not a mark todo as complete if todo does not belong to user", async () => {
    // eslint-disable-next-line no-unused-vars
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({
      title: "Buy Clothes",
      userId: user.id,
    });

    const [_, loginCookie2] = await makeUserAndCookie({
      firstName: "Harry",
      lastName: "Potter",
      email: "harry@pottermore.com",
      password: "random",
    });

    expect(todo.completed).toBe(false);

    const response = await client
      .put(`/todos/${todo.id}`)
      .set("Cookie", [csrfCookie, loginCookie2])
      .send({
        completed: true,
        _csrf,
      });
    expect(response.text).toBe("false");
    await todo.reload();
    expect(todo.completed).toBe(false);
  });

  it("Should mark a todo as complete", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({ title: "Buy Clothes", userId: user.id });
    expect(todo.completed).toBe(false);

    const response = await client
      .put(`/todos/${todo.id}`)
      .set("Cookie", [csrfCookie, loginCookie])
      .send({ completed: true, _csrf });

    expect(response.status).toBe(200);
    await todo.reload();
    expect(todo.completed).toBe(true);
  });

  it("Should not a mark todo as incomplete without csrf token", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({ title: "Buy Clothes", userId: user.id });
    todo.completed = true;
    await todo.save();
    expect(todo.completed).toBe(true);

    const response = await client
      .put(`/todos/${todo.id}`)
      .set("Cookie", loginCookie)
      .send({ completed: true });
    expect(response.status).toBe(500);
    await todo.reload();
    expect(todo.completed).toBe(true);
  });

  it("Should not a mark todo as incomplete if todo does not belong to the user", async () => {
    const [user, _] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });

    const todo = await makeTodo({
      title: "Buy Clothes",
      userId: user.id,
    });
    todo.completed = true;
    await todo.save();
    expect(todo.completed).toBe(true);

    // eslint-disable-next-line no-unused-vars
    const [user2, loginCookie2] = await makeUserAndCookie({
      firstName: "Harry",
      lastName: "Potter",
      email: "harry@pottermore.com",
      password: "random",
    });

    const response = await client
      .put(`/todos/${todo.id}`)
      .set("Cookie", [csrfCookie, loginCookie2])
      .send({ completed: false, _csrf });
    expect(response.text).toBe("false");
    await todo.reload();
    expect(todo.completed).toBe(true);
  });

  it("Should not a mark todo as incomplete without login", async () => {
    const [user, _] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({ title: "Buy Clothes", userId: user.id });
    todo.completed = true;
    await todo.save();
    expect(todo.completed).toBe(true);

    const response = await client
      .put(`/todos/${todo.id}`)
      .set("Cookie", csrfCookie)
      .send({ completed: false, _csrf });
    expect(response.status).toBe(302);
    await todo.reload();
    expect(todo.completed).toBe(true);
  });

  it("Should mark a todo as incomplete", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({ title: "Buy Clothes", userId: user.id });
    todo.completed = true;
    await todo.save();
    expect(todo.completed).toBe(true);

    const response = await client
      .put(`/todos/${todo.id}`)
      .set("Cookie", [csrfCookie, loginCookie])
      .send({ completed: false, _csrf });

    expect(response.status).toBe(200);
    await todo.reload();
    expect(todo.completed).toBe(false);
  });
  it("Should not delete a todo without csrf token", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({ title: "Buy Clothes", userId: user.id });
    const response = await client
      .delete(`/todos/${todo.id}`)
      .set("Cookie", loginCookie)
      .send();
    expect(response.status).toBe(500);
    await todo.reload();
    expect(todo.id).toBeDefined();
  });

  it("Should not delete a todo without login", async () => {
    const [user, _] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({ title: "Buy Clothes", userId: user.id });
    const response = await client
      .delete(`/todos/${todo.id}`)
      .set("Cookie", csrfCookie)
      .send({ _csrf });
    expect(response.status).toBe(302);
    await todo.reload();
    expect(todo.id).toBeDefined();
  });

  it("Should not delete a todo if todo does not belong to user", async () => {
    const [user, _] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });

    const todo = await makeTodo({
      title: "Buy Clothes",
      userId: user.id,
    });

    // eslint-disable-next-line no-unused-vars
    const [user2, loginCookie2] = await makeUserAndCookie({
      firstName: "Harry",
      lastName: "Potter",
      email: "harry@pottermore.com",
      password: "random",
    });

    const response = await client
      .delete(`/todos/${todo.id}`)
      .set("Cookie", [csrfCookie, loginCookie2])
      .send({ _csrf });
    expect(response.text).toBe("false");
    await todo.reload();
    expect(todo.id).toBeDefined();
  });

  it("Should delete a todo", async () => {
    const [user, loginCookie] = await makeUserAndCookie({
      firstName: "Jacob",
      lastName: "Kowalski",
      email: "jacob@pottermore.com",
      password: "random",
    });
    const todo = await makeTodo({ title: "Buy Clothes", userId: user.id });

    const response = await client
      .delete(`/todos/${todo.id}`)
      .set("Cookie", [csrfCookie, loginCookie])
      .send({ _csrf });

    expect(response.status).toBe(200);
    expect(async () => {
      return await todo.reload();
    }).rejects.toThrow(
      "Instance could not be reloaded because it does not exist anymore (find call returned null)"
    );
  });
});
