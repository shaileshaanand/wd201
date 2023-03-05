"use strict";
const { Model, Op } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Todo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    // static associate(models) {
    //   // define association here
    // }
    static async addTask(params) {
      return await Todo.create(params);
    }

    static async showList() {
      console.log("My Todo list \n");

      console.log("Overdue");
      console.log(
        (await Todo.overdue())
          .map((task) => task.displayableString())
          .join("\n")
          .trim()
      );
      console.log("\n");

      console.log("Due Today");
      console.log(
        (await Todo.dueToday())
          .map((task) => task.displayableString())
          .join("\n")
          .trim()
      );
      console.log("\n");

      console.log("Due Later");
      console.log(
        (await Todo.dueLater())
          .map((task) => task.displayableString())
          .join("\n")
          .trim()
      );
    }

    static async overdue() {
      return await Todo.findAll({
        where: {
          dueDate: { [Op.lt]: new Date() },
        },
      });
    }

    static async dueLater() {
      return await Todo.findAll({
        where: {
          dueDate: { [Op.gt]: new Date() },
        },
      });
    }

    static async dueToday() {
      return await Todo.findAll({
        where: {
          dueDate: { [Op.eq]: new Date() },
        },
      });
    }

    static async markAsComplete(id) {
      await Todo.update(
        { completed: true },
        {
          where: {
            id: id,
          },
        }
      );
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
