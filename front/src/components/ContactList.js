import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

import Button from "./Button";
import AddContact from "./AddContact";

import config from "../config/";

import "./ContactList.css";

function ContactList(props) {
	const [isAddContactPresent, setIsAddContactPresent] = useState(false);
	const [contactList, setContactList] = useState(null);
	const [contactUpdateTrigger, setContactUpdateTrigger] = useState(0);

	useEffect(() => {
		const getContactList = async () => {
			const result = await axios.get(config.backend.url + "/user/contacts", {
				headers: { claimedsession: props.sessionCookie },
			});
			setContactList(result.data.contactList);
		};
		getContactList();
	}, [props.sessionCookie, contactUpdateTrigger]);

	const toggleAddContact = () => {
		setIsAddContactPresent(!isAddContactPresent);
	};

	const generateContactList = () => {
		if (contactList) {
			return contactList.map((currentContact) => (
				<Link
					to={{
						pathname: "/chat",
						state: { contact: currentContact },
					}}
					className="contact"
					key={currentContact.name + currentContact.surname}
				>
					<div className="contact__name">{currentContact.name}</div>
					<div className="contact__surname">{currentContact.surname}</div>
				</Link>
			));
		}
	};

	return (
		<>
			<div className="contact-list">
				<div className="contact-list-header">
					<div className="contact-list-header__title">Contacts</div>
					<div className="contact-list-header__add-contact">
						<Button
							type="button"
							onClick={toggleAddContact}
							text={isAddContactPresent ? "Close" : "Add contact"}
						/>
					</div>
				</div>
				{isAddContactPresent ? (
					<AddContact
						sessionCookie={props.sessionCookie}
						setMessage={props.setMessage}
						setMessageType={props.setMessageType}
						contactUpdateTrigger={contactUpdateTrigger}
						setContactUpdateTrigger={setContactUpdateTrigger}
					/>
				) : null}
				<div className="contact-list-body">{generateContactList()}</div>
			</div>
		</>
	);
}

export default ContactList;
