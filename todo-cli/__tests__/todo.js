const todoList = require("../todo");

const { all, markAsComplete, add, overdue, dueToday, dueLater } = todoList();

const addTodo = (
  { title = null, completed = null, dueDate = null } = {
    title: null,
    completed: null,
    dueDate: null,
  }
) => {
  add({
    title: title ?? "new todo",
    completed: completed ?? false,
    dueDate: dueDate ?? new Date().toLocaleDateString("en-CA"),
  });
};

describe("TodoList Test Suite", () => {
  beforeEach(() => {
    all.length = 0;
  });

  test("should add new todo", () => {
    const todoItemsCount = all.length;
    addTodo();
    expect(all.length).toBe(todoItemsCount + 1);
  });

  test("should mark todo as complete", () => {
    addTodo({ completed: false });
    expect(all[0].completed).toBe(false);
    markAsComplete(0);
    expect(all[0].completed).toBe(true);
  });

  test("should return overdue items", () => {
    addTodo();
    addTodo({
      dueDate: new Date(
        new Date().setDate(new Date().getDate() - 1)
      ).toLocaleDateString("en-CA"),
    });
    expect(all.length).toBe(2);
    expect(overdue().length).toBe(1);
  });

  test("should return due today items", () => {
    addTodo({
      dueDate: new Date(
        new Date().setDate(new Date().getDate() - 1)
      ).toISOString(),
    });
    add({
      title: "new todo",
      completed: false,
      dueDate: new Date().toISOString(),
    });
    expect(all.length).toBe(2);
    expect(dueToday().length).toBe(1);
  });

  test("should return due later", () => {
    addTodo({
      dueDate: new Date(
        new Date().setDate(new Date().getDate() + 1)
      ).toLocaleDateString("en-CA"),
    });
    add({
      title: "new todo",
      completed: false,
      dueDate: new Date().toLocaleDateString("en-CA"),
    });
    expect(all.length).toBe(2);
    expect(dueLater().length).toBe(1);
  });
});
