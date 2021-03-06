const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcrypt");
const config = require("../config/");
const debug = require("debug")("back:server");
const generateStringID = require("../utils/stringIDGenerator");

const SALT_WORK_FACTOR = config.passwd.bcrypt_salt_work_factor;

/**
 * Represents a user in database.
 * @class UserSchema
 * @property {string} name - User's firstname
 * @property {string} surname - User's lastname
 * @property {string} email - User's email address
 * @property {string} [bio] - User's biography
 * @property {string} password - User's hashed password
 * @property {string} [sessionSecret] - User's session id
 * @property {Date} [lastAccessed] - User's last active date
 * @property {array} contacts - User's contacts
 * @property {Function} createSession {@link UserSchema.createSession}
 */
let UserSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: [true, "can't be blank"],
			match: [/^[a-zA-Z\s-]{3,}$/, "is invalid"],
		},
		surname: {
			type: String,
			required: [true, "can't be blank"],
			match: [/^[a-zA-Z\s-]{3,}$/, "is invalid"],
		},
		email: {
			type: String,
			lowercase: true,
			unique: true,
			required: [true, "can't be blank"],
			match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Is invalid"],
			index: true,
		},
		bio: String,
		password: {
			type: String,
			required: [true, "can't be blank"],
		},
		sessionSecret: {
			type: String,
		},
		lastAccessed: Date,
		contacts: [{ type: Schema.Types.ObjectId, ref: "User" }],
	},
	{ timestamps: true }
);

/**
 * Uses bcrypt library to generate a hash based on user input.
 * @method generateHashedPassword
 * @async
 * @param {string} plainTextPassword - User entered plain text password
 * @returns {string} HashedPassword
 */
async function generateHashedPassword(plainTextPassword) {
	try {
		const salt = await bcrypt.genSalt(SALT_WORK_FACTOR);
		const hash = await bcrypt.hash(plainTextPassword, salt);
		return hash;
	} catch (e) {
		debug(e);
	}
}

/**
 * Checks the user input password in plain text over the hash.
 * @method checkPlainTextOverHash
 * @async
 * @param {string} plainText - User's password in plain text
 * @param {string} hash - User's password hash
 * @returns {boolean} Does match or not.
 */
async function checkPlainTextOverHash(plainText, hash) {
	return await bcrypt.compare(plainText, hash);
}

UserSchema.pre("save", async function (next) {
	const user = this;

	// only hash the password if it has been modified (or is new)
	if (!user.isModified("password")) return next();

	const hashedPassword = await generateHashedPassword(user.password);
	user.password = hashedPassword;
	next();
});

/**
 * Calls {@link checkPlainTextOverHash} to check the claim.
 * @method UserSchema.verifyPassword
 * @async
 * @memberof UserSchema
 * @param {string} claimedPassword - User entered password claim in plain text
 * @returns {boolean} Result of comparison
 */
UserSchema.methods.verifyPassword = async function (claimedPassword) {
	return await checkPlainTextOverHash(claimedPassword, this.password);
};

/**
 * @typedef {Object} createSessionResult
 * @property {boolean} result.status - Indicating success/failure status
 * @property {string} [result.sessionSecret] - if successful, returns a session id
 */

/**
 * Calls {@link generateStringID} to create a session id and saves it to database
 * @method UserSchema.createSession
 * @async
 * @memberof UserSchema
 * @returns {createSessionResult}
 */
UserSchema.methods.createSession = async function () {
	try {
		const sessionSecret = generateStringID(config.general.stringIDLength);
		this.sessionSecret = sessionSecret;
		await this.save();
		return { status: true, sessionSecret: sessionSecret };
	} catch (e) {
		debug(e);
		return { status: false };
	}
};

/**
 * Destroys a session id by finding and setting it to null.
 * @method UserSchema.destroySession
 * @async
 * @static
 * @memberof UserSchema
 * @param {string} sessionSecret - Session id to destroy
 * @returns {boolean} Status of the action performed
 */
UserSchema.statics.destroySession = async function (sessionSecret) {
	try {
		const user = await mongoose
			.model("User")
			.findOne({ sessionSecret: sessionSecret });
		if (!user) {
			return false;
		}
		user.sessionSecret = null;
		user.lastAccessed = new Date();
		await user.save();
		return true;
	} catch (e) {
		debug(e);
		return false;
	}
};

/**
 * Verifies session validation by it's existence and last accessed date
 * @method UserSchema.checkSession
 * @async
 * @static
 * @memberof UserSchema
 * @param {string} claimedSession
 * @returns {boolean} Status of verification
 */
UserSchema.statics.checkSession = async function (claimedSession) {
	try {
		if (!claimedSession) {
			return false;
		}
		const user = await mongoose
			.model("User")
			.findOne({ sessionSecret: claimedSession });
		if (!user) {
			return false;
		}
		const expirationDate = new Date(
			user.lastAccessed.getTime() + config.general.validSessionTime
		);
		return new Date().getTime() <= expirationDate.getTime();
	} catch (e) {
		debug(e);
		return false;
	}
};

/**
 * Updates the session by updating it's last accessed date
 * @method UserSchema.updateSession
 * @async
 * @static
 * @memberof UserSchema
 * @param {string} claimedSession
 * @returns {boolean} Status of the action performed
 */
UserSchema.statics.updateSession = async function (claimedSession) {
	try {
		if (!claimedSession) {
			return false;
		}
		let user = await mongoose
			.model("User")
			.findOne({ sessionSecret: claimedSession });
		if (!user) {
			return false;
		}
		user.lastAccessed = new Date();
		await user.save();
		return true;
	} catch (e) {
		debug(e);
		return false;
	}
};

/**
 * @typedef {Object} addConntactResult
 * @property {boolean} result.status - Indicating success/failure status
 * @property {string} [result.error] - if failed, returns an error
 */

/**
 * Adds a contact to the user's contact list
 * @method UserSchema.addContact
 * @async
 * @static
 * @memberof UserSchema
 * @param {string} userSession - Current user's session to add a contact to
 * @param {string} contactEmail - Contact's email
 * @returns {addConntactResult}
 */
UserSchema.statics.addContact = async function (userSession, contactEmail) {
	try {
		const user = await mongoose.model("User").findOne({
			sessionSecret: userSession,
		});
		if (!user) {
			return { result: false, error: "Invalid session." };
		}
		const contact = await mongoose.model("User").findOne({
			email: contactEmail,
		});
		if (!contact) {
			return { result: false, error: "Invalid contact." };
		}
		user.contacts.push(contact._id);
		await user.save();
		return { result: true };
	} catch (e) {
		debug(e);
		return { result: false, error: "An error occured." };
	}
};

/**
 * @typedef {Object} getContactsResult
 * @property {boolean} result.result - Indicating success/failure status
 * @property {string} [result.error] - if failed, returns an error
 * @property {arrary} [result.contactList] - if successful, returns the contact list
 */

/**
 * Get contact list of a user
 * @method UserSchema.getContacts
 * @async
 * @static
 * @memberof UserSchema
 * @param {string} userSession - User's session to get contacts of
 * @returns {getContactsResult}
 */
UserSchema.statics.getContacts = async function (userSession) {
	try {
		const user = await mongoose
			.model("User")
			.findOne({ sessionSecret: userSession })
			.populate("contacts", "name surname")
			.exec();
		if (!user) {
			return { result: false, error: "Invalid session." };
		}
		return { result: true, contactList: user.contacts };
	} catch (e) {
		debug(e);
		return { result: false, error: "Database error occured." };
	}
};

module.exports = {
	User: mongoose.model("User", UserSchema),
	generateHashedPassword: generateHashedPassword,
	checkPlainTextOverHash: checkPlainTextOverHash,
};
