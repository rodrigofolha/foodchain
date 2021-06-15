const Order = require('../../models/Order');
const Customer = require('../../models/Customer');

const Yup = require('yup');

module.exports = {
  async index(req, res) {
    const restaurant_id = req.userId;
    const orders = await Order.findAll({
      where: { restaurant_id: restaurant_id },
    });
    console.log(orders)
    return res.json(orders);
  },

  async update(req, res) {
    const restaurant_id = req.userId;
    const order_id = req.params.id;

    const schema = Yup.object().shape({
      status: Yup.string(),
      cancel: Yup.boolean()
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Form validation error' });
    }

    const { status, cancel }  = req.body

    let updates = {};

    if (!cancel){
      if (status === 'ORDERED'){
        updates.state = 'CANCELED BY RESTAURANT';
      } else if (status === 'PREPARATION') {
        updates.state = 'CANCELED BY RESTAURANT';
      } else if (status === 'WAITING') {
        updates.state = 'CANCELED BY RESTAURANT';
      } else if (status === 'READY') {
        updates.state = 'CANCELED BY RESTAURANT';
      } else if (status === 'DISPATCHED') {
        updates.state = 'CANCELED BY RESTAURANT';
      } else {
      return res.status(400).json({error: 'Error transition invalid!'})
      }
    } else {
      if (status === 'ORDERED'){
        updates.state = 'PREPARATION';
      } else if (status === 'PREPARATION') {
        updates.state = 'PREPARATION';
      } else if (status === 'WAITING') {
        updates.state = 'READY';
      } else if (status === 'READY') {
        updates.state = 'READY';
      } else if (status === 'DISPATCHED') {
        updates.state = 'DISPATCHED';
      } else if (status === 'DELIVERED') {
        updates.state = 'CONCLUDED';
      } else if (status === 'CONCLUDED') {
        updates.state = 'DISPATCHED';
      } else {
      return res.status(400).json({error: 'Error transition invalid!'})
      }
    }

    const order = await Order.findOne({
      where: {id: order_id, restaurant_id: restaurant_id },
    })
    const update = await order.update(updates);
    return res.json(update);
  }
}