"use strict";
const { Model, Op } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Todo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Todo.belongsTo(models.User, {
        foreignKey: "userId",
      });
    }

    static addTodo({ title, dueDate, completed = false, userId }) {
      return this.create({ title: title, dueDate, completed, userId });
    }

    static async dueLater(userId) {
      return await Todo.findAll({
        where: {
          dueDate: { [Op.gt]: new Date() },
          completed: false,
          userId,
        },
        order: [
          ["dueDate", "ASC"],
          ["title", "ASC"],
        ],
      });
    }

    static async dueToday(userId) {
      return await Todo.findAll({
        where: {
          dueDate: { [Op.eq]: new Date() },
          completed: false,
          userId,
        },
        order: [
          ["dueDate", "ASC"],
          ["title", "ASC"],
        ],
      });
    }
    static async overdue(userId) {
      return await Todo.findAll({
        where: {
          dueDate: { [Op.lt]: new Date() },
          completed: false,
          userId,
        },
        order: [
          ["dueDate", "ASC"],
          ["title", "ASC"],
        ],
      });
    }

    static async completed(userId) {
      return await Todo.findAll({
        where: {
          completed: true,
          userId,
        },
        order: [
          ["dueDate", "ASC"],
          ["title", "ASC"],
        ],
      });
    }

    static setCompletionStatus(id, userId, status) {
      return Todo.update(
        { completed: status },
        {
          where: {
            id,
            userId,
          },
        }
      );
    }

    static delete(id, userId) {
      return this.destroy({
        where: {
          id,
          userId,
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
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: true,
          len: 1,
        },
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: { notNull: true },
      },
      completed: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Todo",
    }
  );
  return Todo;
};
