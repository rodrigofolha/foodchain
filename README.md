<!-- 
<h4 align="center">
<img src="https://wearesocial-net.s3.amazonaws.com/us/wp-content/uploads/sites/7/2019/05/WAS_NYC_WEB_LOGOSUber-Eats.png" width="250px"/><br>
 <b>Food delivery system based on blockchain</b>
</h4>
<p align="center">
   <a href="https://github.com/joaovitorzv"><img alt="Made by Joao vitor" src="https://img.shields.io/badge/made%20by-joao-red"></a>
   <a href="https://github.com/joaovitorzv/UberEats/blob/develop/LICENSE"><img alt="License" src="https://img.shields.io/github/license/joaovitorzv/UberEats?style=flat-square"></a>
   <a href="https://github.com/joaovitorzv/UberEats"><img alt="Stars" src="https://img.shields.io/github/stars/joaovitorzv/ubereats?style=social">
</p></a> <br>

### Screenshots  📷

*Restaurant manager*
<p float="left">
 <img src="/screenshots/signup-page.png" align="middle" width="380px"/>
 <img src="/screenshots/menu-manager-page.png" align="middle" width="380px"/>
</p>

*Customer*

<p float="left">
 <img src="/screenshots/home-customer-page.png" align="middle" width="380px"/>
 <img src="/screenshots/restaurant-customer-page.png" align="middle" width="380px"/>
</p> -->




### :rocket: Techs
Este projeto está sendo desenvolvido com as seguintes tecnologias:
- [Node.js](https://nodejs.org/en/)
- [Express](https://expressjs.com/pt-br/)
- [Socket.io](https://socket.io/)
- [JWT](https://jwt.io/)
-  [Formik](https://github.com/jaredpalmer/formik)
- [Yup](https://github.com/jquense/yup)
- [React](https://github.com/facebook/react)
- [React Native](https://github.com/facebook/react-native)
- [Styled Components](https://styled-components.com/)

### :muscle: The project

A ideia principal é criar uma aplicação baseada nas principais funcionalidades das tech foods, o design/layout do projeto é baseado no UberEats. 

### 💡 Main features
<hr> 

- <b>Versão Web (Apenas para restaurantes)</b>
	- Cadastro de restaurantes
	- Cadastro de Items  no cardapio
	- Aceitar Pedidos em real time
	- Analytics com pagamentos, taxas etc
- <b>Versão (Apenas para clientes)</b>
	- Cadastro/Login
	- Visualizar todos restaurantes e cardapios
	- Realizar o pagamento de um pedido
	- Resposta do restaurante (real time)
- <b>Versão (Apenas para entregadores)</b>
	- Cadastro/Login
	- Visualizar todos os pedidos disponíveis para entrega
	- Pegar um pedido (real time)

### 🎯 Goals
O objetivo deste projeto, é aprender coisas que serão utilizadas em um ambiente real de trabalho. me desafiei a criar este projeto para enxergar o meu nivel de conhecimento e colocar como projeto no meu portfolio.


### 🔥 How to run this project
***To run API***

Create postgre docker container or run the docker-compose of root folder.
```sh
docker-compose run --name packfood_db -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
$ docker-compose up -d
```
Install the packages run migrations and start API

```sh
$ yarn install
$ yarn sequelize db:migrate
$ yarn dev
```
Dont forgot to configure the ``.env`` environment you can found the example of the variables [Here](api/.env)


***To run Frontend***
```sh
$ yarn install
$ yarn start
```


### :memo: License

This project is unde MIT license. See the file [LICENSE](https://github.com/rodrigofolha/pack-food/blob/develop/LICENSE) to more details.

<p align="center">Thanks to <strong>João vitor oliveira </strong> for template 👋</p>
