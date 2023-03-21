"use strict";
const { Model, Op } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Todo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */

    static addTodo({ title, dueDate }) {
      return this.create({ title: title, dueDate: dueDate, completed: false });
    }

    static async dueLater() {
      return await Todo.findAll({
        where: {
          dueDate: { [Op.gt]: new Date() },
          completed: false,
        },
        order: [
          ["dueDate", "ASC"],
          ["title", "ASC"],
        ],
      });
    }

    static async dueToday() {
      return await Todo.findAll({
        where: {
          dueDate: { [Op.eq]: new Date() },
          completed: false,
        },
        order: [
          ["dueDate", "ASC"],
          ["title", "ASC"],
        ],
      });
    }
    static async overdue() {
      return await Todo.findAll({
        where: {
          dueDate: { [Op.lt]: new Date() },
          completed: false,
        },
        order: [
          ["dueDate", "ASC"],
          ["title", "ASC"],
        ],
      });
    }

    static async completed() {
      return await Todo.findAll({
        where: {
          completed: true,
        },
        order: [
          ["dueDate", "ASC"],
          ["title", "ASC"],
        ],
      });
    }

    static setCompletionStatus(id, status) {
      return Todo.update(
        { completed: status },
        {
          where: {
            id: id,
          },
        }
      );
    }

    static delete(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }

    displayableString() {
      let checkbox = this.completed ? "[x]" : "[ ]";
      return `${this.id}. ${checkbox} ${this.title} ${
        this.dueDate.toString() === new Date().toISOString().slice(0, 10)
          ? ""
          : this.dueDate
      }`.trim();
    }
  }
  Todo.init(
    {
      title: DataTypes.STRING,
      dueDate: DataTypes.DATEONLY,
      completed: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Todo",
    }
  );
  return Todo;
};
