const supertest = require("supertest");
const cheerio = require("cheerio");
const { faker } = require("@faker-js/faker");

const db = require("../models/index");
const { Todo } = require("../models");
const app = require("../app");

let _csrf, csrfCookie;

const today = () => new Date().toISOString().split("T")[0];

const makeTodo = async ({
  title = null,
  dueDate = null,
  completed = false,
} = {}) => {
  return await Todo.addTodo({
    title: title || faker.lorem.words(3),
    dueDate: dueDate || today(),
    completed,
  });
};

const client = supertest(app);

describe("Todo Application", function () {
  beforeAll(async () => {
    const homeResp = await client.get("/");
    const homepage = cheerio.load(homeResp.text);
    csrfCookie = homeResp.headers["set-cookie"][0];
    _csrf = homepage("input[name=_csrf]").attr("value");
  });

  beforeEach(async () => {
    // delete all tables
    await db.sequelize.sync({ force: true });
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
    } catch (error) {
      console.log(error);
    }
  });

  it("Should list overdue Todos", async () => {
    const [todo1, todo2, todo3, todo4] = await Promise.all([
      makeTodo({ dueDate: faker.date.past() }),
      makeTodo({ dueDate: faker.date.future() }),
      makeTodo(),
      makeTodo({ dueDate: faker.date.past(), completed: true }),
    ]);
    const homepage = cheerio.load((await client.get("/")).text);
    const overdueTodosList = homepage("#overdueTodos").text();
    const overdueCount = homepage("#count-overdue").text();
    expect(overdueCount).toBe("1");
    expect(overdueTodosList).toContain(todo1.title);
    expect(overdueTodosList).not.toContain(todo2.title);
    expect(overdueTodosList).not.toContain(todo3.title);
    expect(overdueTodosList).not.toContain(todo4.title);
  });

  it("Should list Todos due today", async () => {
    const [todo1, todo2, todo3, todo4] = await Promise.all([
      makeTodo(),
      makeTodo({ dueDate: faker.date.future() }),
      makeTodo({ dueDate: faker.date.past() }),
      makeTodo({ completed: true }),
    ]);
    const homepage = cheerio.load((await client.get("/")).text);
    const dueTodayTodoList = homepage("#dueTodayTodos").text();
    const dueTodayCount = homepage("#count-due-today").text();
    expect(dueTodayCount).toBe("1");
    expect(dueTodayTodoList).toContain(todo1.title);
    expect(dueTodayTodoList).not.toContain(todo2.title);
    expect(dueTodayTodoList).not.toContain(todo3.title);
    expect(dueTodayTodoList).not.toContain(todo4.title);
  });

  it("Should list Todos due later", async () => {
    const [todo1, todo2, todo3, todo4] = await Promise.all([
      makeTodo({ dueDate: faker.date.future() }),
      makeTodo(),
      makeTodo({ dueDate: faker.date.past() }),
      makeTodo({ dueDate: faker.date.future(), completed: true }),
    ]);
    const homepage = cheerio.load((await client.get("/")).text);
    const dueLaterTodoList = homepage("#dueLaterTodos").text();
    const dueLaterCount = homepage("#count-due-later").text();
    expect(dueLaterCount).toBe("1");
    expect(dueLaterTodoList).toContain(todo1.title);
    expect(dueLaterTodoList).not.toContain(todo2.title);
    expect(dueLaterTodoList).not.toContain(todo3.title);
    expect(dueLaterTodoList).not.toContain(todo4.title);
  });

  it("Should list completed Todos", async () => {
    const [todo1, todo2, todo3, todo4] = await Promise.all([
      makeTodo({ dueDate: faker.date.future(), completed: true }),
      makeTodo(),
      makeTodo({ dueDate: faker.date.past() }),
      makeTodo({ dueDate: faker.date.future() }),
    ]);
    const homepage = cheerio.load((await client.get("/")).text);
    const completedTodoList = homepage("#completedTodos").text();
    const completedCount = homepage("#count-completed").text();
    expect(completedCount).toBe("1");
    expect(completedTodoList).toContain(todo1.title);
    expect(completedTodoList).not.toContain(todo2.title);
    expect(completedTodoList).not.toContain(todo3.title);
    expect(completedTodoList).not.toContain(todo4.title);
  });

  it("Should return all todos in json format", async () => {
    const todoList = await Promise.all([
      makeTodo({ dueDate: faker.date.future(), completed: true }),
      makeTodo(),
      makeTodo({ dueDate: faker.date.past() }),
      makeTodo({ dueDate: faker.date.future() }),
    ]);
    const response = await client.get("/todos");
    expect(response.status).toBe(200);

    expect(response.body.length).toBe(4);

    todoList.map((todoInstance) => {
      const todoObject = response.body.find(
        (item) => item.id === todoInstance.id
      );
      expect(todoInstance.title).toBe(todoObject.title);
      expect(todoInstance.dueDate).toBe(todoObject.dueDate);
      expect(todoInstance.completed).toBe(todoObject.completed);
    });
  });

  it("Should return a todo by id", async () => {
    const todoInstance = await makeTodo();

    const response = await client.get(`/todos/${todoInstance.id}`);

    expect(response.status).toBe(200);

    expect(response.body.id).toBe(todoInstance.id);
    expect(response.body.title).toBe(todoInstance.title);
    expect(response.body.dueDate).toBe(todoInstance.dueDate);
  });

  it("Should not create a new todo using POST request without csrf token", async () => {
    const payload = {
      title: faker.lorem.words(3),
      dueDate: faker.date.recent(),
    };
    const response = await client.post("/todos").send(payload);
    expect(response.status).toBe(403);
  });

  it("Should create a new todo using POST request", async () => {
    const payload = {
      title: faker.lorem.words(3),
      dueDate: faker.date.recent().toISOString().split("T")[0],
      _csrf,
    };
    const response = await client
      .post("/todos")
      .set("Cookie", csrfCookie)
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
    const todo = await makeTodo();
    expect(todo.completed).toBe(false);

    const response = await client
      .put(`/todos/${todo.id}`)
      .send({ completed: true });

    expect(response.status).toBe(403);
    await todo.reload();
    expect(todo.completed).toBe(false);
  });

  it("Should mark a todo as complete", async () => {
    const todo = await makeTodo();
    expect(todo.completed).toBe(false);

    const response = await client
      .put(`/todos/${todo.id}`)
      .set("Cookie", csrfCookie)
      .send({ completed: true, _csrf });

    expect(response.status).toBe(200);
    await todo.reload();
    expect(todo.completed).toBe(true);
  });

  it("Should not delete a todo without csrf token", async () => {
    const todo = await makeTodo();
    const response = await client.delete(`/todos/${todo.id}`).send();

    expect(response.status).toBe(403);
    await todo.reload();
    expect(todo.id).toBeDefined();
  });

  it("Should delete a todo", async () => {
    const todo = await makeTodo();

    const response = await client
      .delete(`/todos/${todo.id}`)
      .set("Cookie", csrfCookie)
      .send({ _csrf });

    expect(response.status).toBe(200);
    expect(async () => {
      return await todo.reload();
    }).rejects.toThrow(
      "Instance could not be reloaded because it does not exist anymore (find call returned null)"
    );
  });
});
