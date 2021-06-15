const Yup = require('yup');
const jwt = require('jsonwebtoken');

const Deliveryman = require('../../models/Deliveryman');
const authConfig = require('../../../config/auth');

module.exports = {
  async store(req, res) {
    const schema = Yup.object().shape({
      email: Yup.string().email().required(),
      password: Yup.string().required()
    });

    if (!(await schema.isValid(req.body))) {
      return res.json({ error: 'Form validation failed'});
    }

    const {
      email,
      password
    } = req.body;

    const deliveryman = await Deliveryman.findOne({
       where: { email }
    })

    if (!deliveryman) {
      return res.status(401).json({ error: 'This email not registered' });
    }

    if (!(await deliveryman.checkPassword(password))) {
      return res.status(401).json({ error: 'Password does not match'});
    }

    const { id, name, transport } = deliveryman;

    return res.json({
      deliveryman: {
        id,
        name, 
        email,
        transport
      },
      token: jwt.sign({ id }, authConfig.secret)
    });

  }
}