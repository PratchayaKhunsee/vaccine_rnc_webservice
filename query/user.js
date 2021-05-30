/**
 * @typedef {Object} UserEditableInfo
 * 
 * Allowed editable user information
 * 
 * @property {String} [firstname]
 * @property {String} [lastname]
 * @property {Number} [gender]
 * @property {Number} [name_prefix]
//  * @property {String} [id_number]
 * 
 * @typedef {Object} UserInfo
 * 
 * A user information.
 * 
 * @property {String} firstname
 * @property {String} lastname
 * @property {Number} gender
 * @property {Number} name_prefix
//  * @property {String} id_number
 * 
 * @typedef {Object} PasswordModifier
 * 
 * Optional; Password modifier object
 * 
 * @property {String} old
 * @property {String} new
 */

/** @namespace */

const { ERRORS, ErrorWithCode, } = require('../error');
/**
 * List of editable user infomation attributes
 */
const editableAttr = [
    'firstname',
    'lastname',
    'gender',
    'name_prefix'
];

// =====================================

/**
 * Get the personal information
 * 
 * @param {import('pg').Client} client
 * @param {String} username 
 */
async function viewUser(client, username) {

    // Check the user information by username
    let user = await client.query(
        'SELECT person_id FROM user_account WHERE username = $1',
        [
            String(username)
        ]
    );
    if (user.rows.length != 1) {
        return new ErrorWithCode(ERRORS.USER_NOT_FOUND);
    }

    // Get the personal information with person information
    let person = await client.query(
        'SELECT firstname,lastname,gender,name_prefix FROM person WHERE id = $1',
        [
            Number(user.rows[0].person_id)
        ]
    );

    if (person.rows.length != 1) {
        return new ErrorWithCode(ERRORS.USER_NOT_FOUND);
    }

    /** @type {UserInfo} */
    const result = { ...person.rows[0] };

    return result;
}

// =====================================

/**
 * Edit some user information
 * @param {import('pg').Client} client
 * @param {String} username  
 * @param {UserEditableInfo} info
 */
async function editUserInfo(client, username, info) {

    try {
        let cloned = { ...info };
        for (let attr in cloned) {
            if (!editableAttr.find(_attr => _attr == attr)) delete info[attr];
        }

        await client.query('BEGIN');

        // Get the user information with username
        let user = await client.query(
            'SELECT person_id FROM user_account WHERE username = $1',
            [
                String(username)
            ]
        );

        // No need to update if it has no found user
        if (user.rows.length != 1) {
            throw ERRORS.USER_NOT_FOUND;
        }

        // Updating user information.
        if (info) {
            let keys = Object.keys(cloned);
            let values = [
                Number(user.rows[0].person_id)
            ];
            Array.prototype.unshift.apply(values, Object.values(cloned));
            let i = 1;
            var updating = await client.query(
                `UPDATE person SET ${keys.map(x => `${x} = $${i++}`)} WHERE id = $${i}
                    RETURNING firstname,lastname,gender,name_prefix
                `,
                values
            );

            // Cancel the user information updating if it has caught an error
            if (updating.rowCount != 1) {
                throw ERRORS.MODIFYING_USER_ERROR;
            }
        } else {
            throw ERRORS.MODIFYING_USER_ERROR;
        }

        await client.query('COMMIT');

        /** @type {UserInfo} */
        const result = { ...updating.rows[0] };

        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        return new ErrorWithCode(error);
    }

}

/**
 * Edit user account information like password.
 * @param {import('pg').Client} client
 * @param {String} username  
 * @param {PasswordModifier} password 
 */
async function editUserAccount(client, username, password) {
    try {
        await client.query('BEGIN');

        console.log(password);

        if (password) {

            var modified = await client.query(
                `UPDATE user_account SET password = crypt($1, gen_salt('md5')) WHERE username = $2 AND password = crypt($3, password)`,
                [
                    password.new,
                    username,
                    password.old
                ]
            );

            console.log(modified.rows);

            if (modified.rowCount != 1) {
                throw ERRORS.MODIFYING_USER_ERROR;
            }
        } else {
            throw ERRORS.MODIFYING_USER_ERROR;
        }

        return true;
    } catch (error) {
        console.log(error);

        await client.query('ROLLBACK');
        return new ErrorWithCode(error);
    }

}

// =====================================

/** Exported modules */
module.exports = {
    viewUser,
    editUserInfo,
    editUserAccount
}