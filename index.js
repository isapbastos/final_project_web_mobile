const fs 					= require('fs');
const path				    = require('path');
const multer 				= require("multer");
const express 				= require('express');
const mongoose 				= require('mongoose');
const session 				= require('express-session');
const bodyParser = require('body-parser');
const passport 				= require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const _ 					= require('lodash');
const http 					= require('http');
const https 				= require('https');
const app 					= express();
const nodemailer 			= require('nodemailer');
require('dotenv').config();
var ObjectId = require('mongodb').ObjectID;
const PORTA_OKAY = 200;
const PORTA_LOCAL_HTTP = 3000;
const PORTA_LOCAL_HTTPS = 8000;
//const MongoStore 			= require('connect-mongo')(session);

app.use(express.static('public')); // rederizar a pasta public (arquivos estáticos)
app.use('/usersInfo', express.static(path.join(__dirname, '/usersInfo'))); 
app.set('view engine', 'ejs'); 
app.use(express.urlencoded({ extended: true })); //isso substitui o bodyParser, que está deprecated

const options = {
	key: fs.readFileSync("key.pem"), //SSL certificate para criar um servidor htttps
	cert: fs.readFileSync("key-cert.pem")
};

const readJsonSync = (filePath) => {
	file = fs.readFileSync(filePath, 'utf8')
	return JSON.parse(file)
}

mongoose.connect(process.env.DATABASE_CONNECTION_STRING, {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true,dbName: 'BEHEALTH'}).then(() => console.log('DB Connected!')).catch(err => {
    console.log("Erro ao conectar o DB", err.message)
})//conecta o app ao BD do cloud mongodb
mongoose.set('useCreateIndex', true);

app.use(session({
	secret: process.env.SECRET_SESSION,
	resave: false,
	saveUninitialized: false	
}))	

app.use(passport.initialize());
app.use(passport.session());

const userSchema = mongoose.Schema ({
	username: String,//email do usuário
	name: String,
	city: String,
	uf: String,
	telephone: String,
	registerType: String,
	description: String,
	messagesList: [{
		idUser: String,
		messages: [
			{
				date: Date,
				message: String,
				isOwnUser: Boolean
			}
		]
	}],
	password: String	
});

userSchema.plugin(passportLocalMongoose);             // Passa o schema de usuário para o mongoDB
const User = new mongoose.model('User', userSchema);   // vericar ...
module.exports = mongoose.model('User', userSchema);
// A partir daqui, usa-se o passaporte pois é útil para autenticação do usuário
passport.use(User.createStrategy())                   // vericar ...

passport.serializeUser(function(user, done) { //determina quais dados do objeto de usuário devem ser armazenados na sessão
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {//o id (user.id) corresponde à chave do objeto de usuário que foi atribuída à função executada.  Assim, todo o seu objeto é recuperado com a ajuda dessa chave. Em deserializeUser, essa chave corresponde à matriz / banco de dados da memória ou a qualquer recurso de dados
	User.findById(id, function(err, user) {
		done(err, user);
	});
});

passport.serializeUser((user, done) => {
	return done(null, user._id);
});

passport.deserializeUser((id, done) => {
	User.findById(id, (err, user) => {
			if (!err) {
					return done(null, user);
			} else {
					return done(err, null);
			}
	});
});

const signupResponse = require('./funcoes/signupResponse');

// Se o usuário estiver autenticado, ele é autorizado a ir pra route, senão ele vai para a página de login
function authenticationUserMiddleware() {  
	return function (req, res, next) {
		if (req.isAuthenticated()) {
			return next()
		}
		res.render('signinFailure');
	}
}

function findAndUpdateUser(conditionForUpdate, objForUpdate) {
	return new Promise((resolve, reject) => {
		User.findOneAndUpdate(conditionForUpdate, objForUpdate, function callback (error, success) {
			if (error || success===null) {
				reject();
			} else {
				resolve(success);
			}
		});
	})
}

function findAndReturnAllRegistration(filterField) {
	return new Promise((resolve, reject) => {
		function callbackField(err, foundUsers) {
			console.log("foundUsers: ", foundUsers);
			if(err || foundUsers==[]) {
				
				reject(err)
			} else {
				resolve(foundUsers);
			}
		}
		User.find(filterField, callbackField);
	})
}

const readFile = (localPath) => {
	return new Promise((resolve, reject) => {
		fs.readFile(localPath, (errorTryingToAccess) => {
			if(errorTryingToAccess && errorTryingToAccess.code === 'ENOENT') {
				reject();
			} else {
				resolve(localPath);
			}
		})		
	})
}

const uploadFunction = (imageName) => {
	const storage = multer.diskStorage({
		destination: (req, file, cb) => {
			cb(null, path.join(__dirname, '/usersInfo/' + req.user._id));
		},
		filename: (req, file, cb) => {
			cb(null, imageName /*+ path.extname(file.originalname)*/);
		}
	});
	const fileFilter = (req, file, cb) => {
		if (file.mimetype == 'image/jpeg'  || file.mimetype == 'image/png') {
			cb(null, true);
		} else {
			cb(null, false);
		}
	}
	const upload = multer({ storage: storage, fileFilter: fileFilter }).single('image');
	return upload
}

app.get('/', (req, res) => {
	res.render("home");
});

app.get('/contact', (req, res) => {
	res.render("contact");
});

app.get('/signup', (req, res) => {
	res.render("signup");
});

app.get('/signin', (req, res) => {
	res.render("signin");
});

app.get('/welcome', authenticationUserMiddleware(), (req, res)=>{
	const user = req.user;
	const userFiles = user._id;
	let people = user.registerType==="Aluno(a)" ? "tutores(as)" : "alunos(as)";
	fs.access('usersInfo/'+ userFiles, (errorTryingToAccess) => {
		if(errorTryingToAccess && errorTryingToAccess.code === 'ENOENT') {
			fs.mkdir('usersInfo/' + userFiles, (mkdirError) => {
				readFile('usersInfo/'+  userFiles +  "/profileImg.png")
				.then(() => {
					res.render('welcome', {user, people: people, picture: 'usersInfo/'+  userFiles +  "/profileImg.png"})
				}).catch(()=> {
					res.render('welcome', { user, people: people, picture: 'assets/img/bg-profile-in-basic.jpg'})
				})
			})
		} else {
			readFile('usersInfo/'+  userFiles +  "/profileImg.png")
			.then(() => {
				res.render('welcome', {user, people: people, picture: 'usersInfo/'+  userFiles +  "/profileImg.png"})
			}).catch(()=> {
				res.render('welcome', { user, people: people, picture: 'assets/img/bg-profile-in-basic.jpg'})
			})
		}
	})
})

app.get('/edit', authenticationUserMiddleware(), (req, res)=>{
	const user = req.user;
	let people = user.registerType==="Aluno(a)" ? "tutores(as)" : "alunos(as)";
	res.render('edit', {user, people: people});
})

app.get('/messages', authenticationUserMiddleware(), (req, res)=>{
	const user = req.user;
	const userFiles = user._id;
	let people = user.registerType==="Aluno(a)" ? "tutores(as)" : "alunos(as)";
	let objFilterField = {};
	
	user.messagesList.forEach(element => {
		objFilterField._id = ObjectId(element.idUser);
	});

	console.log(objFilterField);
	readFile('usersInfo/'+  userFiles +  "/profileImg.png")
	.then(() => {//pega os dados da pessoa e o nome
	findAndReturnAllRegistration(objFilterField)
	.then(foundUsers=>{
		res.render('messages', {user, people: people, messageList: user.messageList, foundUsers: foundUsers, picture: 'usersInfo/'+  userFiles +  "/profileImg.png"});
	}).catch(err=>{
		res.render("editPost",{user, people: people, picture: 'usersInfo/'+  userFiles +  "/profileImg.png", msg: "Você não possui mensagens no momento!"});
	});
	}).catch(()=> {
		findAndReturnAllRegistration(objFilterField)
	.then(foundUsers=>{
		res.render('messages', { user, people: people, messageList: user.messageList, foundUsers: foundUsers, picture: 'assets/img/bg-profile-in-basic.jpg'});
	}).catch(err=>{
		res.render("editPost",{user, people: people, picture: 'assets/img/bg-profile-in-basic.jpg', msg: "Você não possui mensagens no momento!"});
	});
	});
})

app.get('/support', authenticationUserMiddleware(), (req, res)=>{
	const user = req.user;
	const userFiles = user._id;
	let people = user.registerType==="Aluno(a)" ? "tutores(as)" : "alunos(as)";
	readFile('usersInfo/'+  userFiles +  "/profileImg.png")
	.then(() => {
		res.render('support', {user, people: people, picture: 'usersInfo/'+  userFiles +  "/profileImg.png"});
	}).catch(err=>{
		res.render('welcome', { user, people: people, picture: 'assets/img/bg-profile-in-basic.jpg'})
	});
})

app.get('/logout', (req, res) => {
	req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

app.get('/search', (req, res) => {
	const user = req.user;
	let objFilterField = (user.registerType === "Tutor(a)"||user.registerType === "Empresa") ? {"registerType": "Aluno(a)"} : {'registerType': {$ne : "Aluno(a)"}};
	findAndReturnAllRegistration(objFilterField)
	.then(foundUsers=>{
		res.render('search', {user, foundUsers: foundUsers});
	}).catch(err=>{
		res.send(err);
	});
});

app.post("/profileEdit", authenticationUserMiddleware(), uploadFunction("profileImg.png"), (req, res, next) => { //salva a nova foto de perfil do usuário
	const user = req.user;
	const userFiles = user._id;
	let people = user.registerType==="Aluno(a)" ? "tutores(as)" : "alunos(as)";
	readFile('usersInfo/'+  userFiles +  "/profileImg.png")
	.then(() => {
		res.render('welcome', {user, people: people, picture: 'usersInfo/'+  userFiles +  "/profileImg.png"});
	}).catch(()=> {
		res.render('welcome', { user, people: people, picture: 'assets/img/bg-profile-in-basic.jpg'});
	});
});

app.post("/support", authenticationUserMiddleware(), uploadFunction("profileImg.png"), (req, res, next) => { //salva a nova foto de perfil do usuário
	const user = req.user;
	const userFiles = user._id;
	let people = user.registerType==="Aluno(a)" ? "tutores(as)" : "alunos(as)";
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
		from: `Email: ${req.body.email}`,
		to: process.env.EMAIL,
		subject: `Suporte de ${req.body.email} x nome social ${req.body.nomeSocial} x assunto ${req.body.title}`,
		text: req.body.msg
	}).then(message => {
		readFile('usersInfo/'+  userFiles +  "/profileImg.png")
		.then(() => {
			res.render("editPost",{user, people: people, picture: 'usersInfo/'+  userFiles +  "/profileImg.png", msg: "Mensagem enviada com sucesso! Em breve entraremos em contato com você!"});
		}).catch(()=> {
			res.render("editPost",{user, people: people, picture: 'assets/img/bg-profile-in-basic.jpg', msg: "Mensagem enviada com sucesso! Em breve entraremos em contato com você!"});
		});
	}).catch(err => {
		readFile('usersInfo/'+  userFiles +  "/profileImg.png")
		.then(() => {
			res.render('supportFailure', {user, people: people, picture: 'usersInfo/'+  userFiles +  "/profileImg.png"});
		}).catch(err=>{
			res.render('supportFailure', { user, people: people, picture: 'assets/img/bg-profile-in-basic.jpg'})
		});
	})
	
});

app.post('/signup', signupResponse);

app.post('/login', (req, res) =>{
	const user = new User({
		username: req.body.username,
		password: req.body.password
	})
	req.login(user, function(err){
		if(err) {
			console.log(err);
			res.render("/signinFailure");
		} else {
			passport.authenticate('local')(req, res, function(){
				res.redirect("/welcome");
			});
		}
	});
});

app.post('/edit', (req, res)=>{
	const user = req.user;
	const username = user.username;
	const userFiles = user._id;
	let objForUpdate = user;
	if (req.body.name) objForUpdate.name = req.body.name;
	if (req.body.city) objForUpdate.city = req.body.city;
	if (req.body.uf) objForUpdate.uf = req.body.uf;
	if (req.body.telephone) objForUpdate.telephone = req.body.telephone;
	if (req.body.description) objForUpdate.description = req.body.description;
	let people = user.registerType==="Aluno(a)" ? "tutores(as)" : "alunos(as)";

	findAndUpdateUser({username: username}, objForUpdate)
	.then(()=>{
		readFile('usersInfo/'+  userFiles +  "/profileImg.png")
		.then(() => {
			res.render("editPost",{user, people: people, picture: 'usersInfo/'+  userFiles +  "/profileImg.png", msg: "Seus dados foram atualizados com sucesso!"});
		}).catch(()=> {
			res.render("editPost",{user, people: people, picture: 'assets/img/bg-profile-in-basic.jpg', msg: "Oh, não! Algo deu errado, tente editar seus dados novamente!"});
		});
	}).catch(()=>{
		readFile('usersInfo/'+  userFiles +  "/profileImg.png")
		.then(() => {
			res.render("editPost",{user, people: people, picture: 'usersInfo/'+  userFiles +  "/profileImg.png", msg: "Seus dados foram atualizados com sucesso!"});
		}).catch(()=> {
			res.render("editPost",{user, people: people, picture: 'assets/img/bg-profile-in-basic.jpg', msg: "Oh, não! Algo deu errado, tente editar seus dados novamente!"});
		});
	});
});

app.post('/contact', (req, res) => {
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
		from: `Email: ${req.body.email}`,
		to: process.env.EMAIL,
		subject: `Contato de ${req.body.email}`,
		text: req.body.msg
	}).then(message => {
		res.render('contactSuccess');
	}).catch(err => {
		console.log("Erro: ", err);
		res.render('contactFailure')
	})
})

let port = process.env.PORT;
if(port == null || port=="")
{
	port=3000;
}

app.listen(port, function() {
	console.log(`Server is running in port ${PORTA_LOCAL_HTTP}!`);
});

// https.createServer(options, (req, res) => {
// 	res.writeHead(PORTA_OKAY);
// 	res.end('BEHEALTH\n');
// 	console.log("Server is running in port 8000!\n");
// }).listen(PORTA_LOCAL_HTTPS);