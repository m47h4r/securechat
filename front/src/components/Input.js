import React from "react";

import "./Input.css";

function Input(props) {
	return (
		<>
			<p className="input__label">{props.name}:</p>
			<input
				className={
					props.noMargin
						? "input__entry input__entry--no-margin"
						: "input__entry"
				}
				name={props.name}
				type={props.type}
				placeholder={props.placeholder}
				value={props.value}
				onChange={props.handleChange}
			/>
		</>
	);
}

export default Input;
