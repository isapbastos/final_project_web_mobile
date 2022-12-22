require('dotenv').config();
const nodemailer = require('nodemailer');
const messageSignup = require("./messages/messagesSignup.json");
const User = require('../index');

/**
 * A função registerUser registra o email e a senha na collection User, e envia um email, para o mesmo, resolve enviando uma mensagem de sucesso. Em caso de erro, rejeita com uma mensagem de falha. 
 * 
 * @function registerUser
 * @param {Object} req - Request
 * @param {Boolean} isManager - Booleana (true ou false). Se for true é um Manager (responsável) do condomínio
 */
const registerUser = (req, isManager) => {
	var newUser = new User({
		username: req.body.username,
		name: req.body.name,
		city: req.body.city,
		uf: req.body.uf,
		telephone: req.body.telephone,
		registerType: req.body.registerType,
		description: req.body.description,
		messagesList: [{
			idUser: "63540abc9694a034041435d1",
			messages: [
				{
					date: new Date(),
					message: "Bem-vindo ao BeHealth! Estamos muito felizes em ter vocês conosco! ",
					isOwnUser: false
				}
			]
		}]
	});

	let responseMessage = {
		routePage: "signupSuccess",
		message: {msg0:messageSignup["MSG_SUCCESS_SIGNUP"], msg1:"", msg2:""}
	}
	return new Promise((resolve, reject) => {
		User.register(newUser, req.body.password, function(err, user) { // rotina para registrar o usuário - passport
			if (err) { // teve erros durante o registro
				console.log("Erro no registro", err);
				responseMessage = {
					routePage: "signupFailure",
					message: {msg0:messageSignup["MSG_ERROR_SIGNUP"], msg1:"", msg2:""}
				}
				reject(responseMessage)
			}
			else {
				console.log("O cadastro foi feito com sucesso")
				let transporter = nodemailer.createTransport({
					host: 'smtp.gmail.com',
					port: 465,
					secure: true,
					auth: {
						user: process.env.EMAIL,
						pass: process.env.PASSWORD
					}
				})
				transporter.sendMail({ 
					from: `<nao-responda@behealth.com>`,
					to: req.body.username,
					subject: "Sua senha foi cadastrada junto ao BeHealth.", 
					text: "Parabéns, "+ req.body.name +"! Sua senha foi cadastrada junto a BeHealth. Caso não seja você que cadastrou, entre em contato conosco e cadastre uma nova senha."
				}).then(message => {
					console.log("O email de cadastro foi enviado com sucesso")
				}).catch(err => {
					console.log("ERRO NO ENVIO DO EMAIL")
				})
				resolve(responseMessage)
			}
		})
	})
}

//TODO: Fazer uma verificação de senha mais forte. Atualmente a requisição de senha está muito fraca.
/**
 * A função validatePasswordUser verifica se a senha tem 6 ou mais caracteres e se ela é igual a senha de confirmação. Se a senha for válida resolve, se a senha não for válida reject().
 * 
 * @function validatePasswordUser
 * @param {Object} req - Request
 */
const validatePasswordUser = (req) => {
	return new Promise((resolve, reject) => {
		if(((req.body.password).length >= 6) && (req.body.password == req.body.passwordConfirmation)) {
			resolve()
		} else {
			reject()
		}
	})
}

/**
 * A função isNotAUser verifica,(caso não tenha erros),  se o email já está cadastrado como User, caso esteja cadastrado rejeita, se não estiver cadastrado resolve. Se tiver erros, rejeita
 * 
 * @function isNotAUser
 * @param {Object} req - Request
 */
const isNotAUser = (req) => {
	return new Promise((resolve, reject) => {
		User.findOne({username: req.body.username}, function(err, foundUser) { //encontrar o usuario registrado
			if(!err){ //se não tiver erros ao tentar encontrar o usuario registrado
				if(!foundUser) {//ainda não é usuário, pode registrar, validando o password antes
					console.log("Não achou o usuario")
					resolve()
				} else {//está no User, usuário já cadastrado
					console.log("O usuario já está cadastrado")
					reject()
				}
			} else {//erro ao tentar achar o User
				console.log("erro ao tentar achar o usuario")
				reject()
				
			}
		})
	})
}

/**
 * A função signupResponse registra o email e a senha do novo usuário(autorizado), na collection User, retornando uma mensagem de sucesso para ele no frontend.
 * Se o usuário digitar uma senha inválida, se ele não estiver autorizado, ou se ele já estiver cadastrado, retorna uma mensagem de falha para ele no frontend.
 * 
 * @function signupResponse
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
const signupResponse = (req, res) => {
	//Collection Admin é da eidro
	let responseMessage;
	isNotAUser(req).
	then(() => { //TODO: verificar se colocar if dentro do then é uma boa prática
		// validatePasswordUser(req).
		// 	then(() => {
					registerUser(req, true).
					then((responseMessage) => {
						res.render(responseMessage.routePage, responseMessage.message)
					} ).
					catch((responseMessage) => {
						res.render(responseMessage.routePage, responseMessage.message)
					})
				// })
			.catch(() => {
				responseMessage = {
					routePage: "signupFailure",
					message: {msg0: messageSignup["MSG_INVALID_PASSWORD"], msg1:"", msg2:"" }
				} 
				res.render(responseMessage.routePage, responseMessage.message)
			})
	}).
	catch(() => {
		responseMessage = {
			routePage: "signupFailure",
			message: {msg0: messageSignup["MSG_INVALID_USER"], msg1:"", msg2:"" }
		} 
		res.render(responseMessage.routePage, responseMessage.message)
	})
}

module.exports = signupResponse
