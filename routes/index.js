var express = require('express');
var router = express.Router();
var multer = require('multer');
var QRCode = require('qrcode');
var helper = require('./../helpers/helper');
var keyConfig = require('./../config');
var QrCode = require('qrcode-reader');
var Jimp = require("jimp");
var nodemailer = require('nodemailer');

var upload = multer({
	dest: 'uploads/'
});

router.get('/', function (req, res, next) {
	res.render('index', {
		JWTData: req.JWTData
	});
});

router.get('/otp',function(req,res){
	res.render('otp', {
		JWTData: req.JWTData
	});
});

router.get('/enterotp',function(req,res){
	res.render('enterotp', {
		JWTData: req.JWTData
	});
});

router.get('/votecandidate', function (req, res, next) {

	if (!req.cookies.votePayload) {
		return res.redirect('/vote');
	}

	var id = req.cookies.votePayload.id;
	var constituency = req.cookies.votePayload.constituency;
	var name = req.cookies.votePayload.name;
	var aadhaar = req.cookies.votePayload.aadhaar;

	res.clearCookie('votePayload');

	req.app.db.models.Candidate.find({
		constituency: constituency
	}, function (err, data) {
		if (err) {
			console.log(err);
			return next(err);
		}
		res.render('votecandidate', {
			JWTData: req.JWTData,
			data: data,
			id: id,
			constituency: constituency,
			name: name,
			aadhaar: aadhaar
		});
	});
});

router.get('/vote', function (req, res, next) {
	res.render('vote', {
		JWTData: req.JWTData
	});
});

router.get('/register', function (req, res, next) {
	res.render('register', {
		JWTData: req.JWTData
	});
});

router.get('/results', function (req, res, next) {
	res.render('results', {
		JWTData: req.JWTData
	});
});

router.get('/test', function (req, res, next) {
	helper.test(5, function (data) {
		res.send(data.toString());
	});
});


var email;

var otp = Math.random();
otp = otp * 1000000;
otp = parseInt(otp);
console.log(otp);


let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    service : 'Gmail',
    
    auth: {
      user: 'cis.contact.request@gmail.com',
      pass: 'ciscontact2020',
    }
    
});
    
router.post('/sendOTP',function(req,res){
    email=req.body.email;
	
	// send mail with defined transport object
    var mailOptions={
        to: req.body.email,
       subject: "Otp for registration is: ",
       html: "<h3>OTP for account verification is </h3>"  + "<h1 style='font-weight:bold;'>" + otp +"</h1>" // html body
     };
     
     transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Message sent: %s', info.messageId);   
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  
        res.redirect('/enterotp');
    });
});

router.post('/verifyOTP',function(req,res){

    if(req.body.otp==otp){
        res.redirect('/vote');
    }
    else{
        res.render('otp',{msg : 'otp is incorrect'});
    }
});  

router.post('/resendOTP',function(req,res){
    var mailOptions={
        to: email,
       subject: "Otp for registration is: ",
       html: "<h3>OTP for account verification is </h3>"  + "<h1 style='font-weight:bold;'>" + otp +"</h1>" // html body
     };
     
     transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Message sent: %s', info.messageId);   
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        res.render('otp',{msg:"otp has been sent"});
    });

});

router.post('/register', upload.single('avatar'), function (req, res, next) {
	console.log("entered /register");

	var voterDetails = {
		name: req.body.name,
		aadhaar: req.body.aadhaar,
		image: req.body.avatar,
		hasVoted: false,
		isValid: false,
		constituency: req.body.constituency
	}

	console.log(voterDetails);

	req.app.db.models.Voter.create(voterDetails, function (err, data) {
		if (err) {
			console.log(err);
			return next(err);
		}

		var voterID = JSON.stringify(data._id);

		QRCode.toDataURL(voterID, function (err, url) {
			console.log(url);
			var im = url.split(",")[1];
			var img = new Buffer(im, 'base64');

			res.writeHead(200, {
				'Content-Type': 'image/png',
				'Content-Length': img.length,
				'Content-Disposition': 'attachment; filename="Voter_QR.png"'
			});
			res.end(img);
		})
	});
});

router.post('/verifyvoter', upload.any(), function (req, res, next) {

	var qr_uri = req.body.qrdata;
	var avatar_uri = req.body.avatar;
	var qr = new QrCode();
	var face1, face2;
	var id;

	var buffer = new Buffer(qr_uri.split(",")[1], 'base64');

	console.log("entered");

	Jimp.read(buffer, function (err, image) {
		if (err) {
			console.error(err);
			// TODO handle error
		}

		qr.callback = function (err, value) {
			if (err) {
				console.error(err);
				// TODO handle error
			}

			id = value.result.substr(1).slice(0, -1);

			req.app.db.models.Voter.findById(id, function (err, data) {
				if (err) {
					console.log(err);
				}
				if (data.hasVoted == true || data.isValid == false) {
				// if (false) {
					return res.render('message', {
						message: 'Sorry! You are not allowed to vote.',
						JWTData: req.JWTData
					});
				} else {
					console.log('Entered here');
					console.log(data.image);

					helper.sendImageToMicrosoftDetectEndPoint(data.image, function (responseA) {
						console.log(responseA);
						responseA = JSON.parse(responseA);
						if (responseA.length == 0) {
							return res.render('message', {
								message: 'Face verification failed. Try again',
								JWTData: req.JWTData
							});
						}

						console.log(responseA[0].faceId);

						face1 = responseA[0].faceId;

						helper.sendImageToMicrosoftDetectEndPoint(avatar_uri, function (responseB) {
							console.log(responseB);
							responseB = JSON.parse(responseB);
							if (responseB.length == 0) {
								return res.render('message', {
									message: 'Face verification failed. Try again',
									JWTData: req.JWTData
								});
							}
							face2 = responseB[0].faceId;

							var payload = JSON.stringify({
								faceId1: face1,
								faceId2: face2
							});

							helper.sendImageToMicrosoftVerifyEndPoint(payload, function (response) {
								console.log(response);
								response = JSON.parse(response);
								if (response.isIdentical == true) {
									var voteUrl = '/votecandidate';

									var votePayload = {
										id: id,
										constituency: data.constituency,
										name: data.name,
										aadhaar: data.aadhaar
									}

									res.cookie('votePayload', votePayload);

									return res.redirect(voteUrl);
								} else {
									return res.render('message', {
										message: 'Face verification failed. Try again',
										JWTData: req.JWTData
									});
								}
							});
						});
					});
				}
			});
		};
		qr.decode(image.bitmap);
	});
});

router.get('/voteadded/:id', function (req, res, next) {
	req.app.db.models.Voter.findById(req.params.id, function (err, data) {
		if (err) {
			console.log(err);
			return next(err);
		}
		data.hasVoted = true;

		data.save();

		return res.redirect('/');
	});
});

module.exports = router;