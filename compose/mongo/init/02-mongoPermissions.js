/*
 * FLASHPHONER COMPANY CONFIDENTIAL
 * __________________________________________
 *
 * [2009] - [2026] Flashphoner company
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Flashphoner company and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Flashphoner company
 * and its suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Flashphoner company.
 */

// script.js

const databaseName = 'zapp_alpha_test';
const username = 'admin';
const password = 'Abcd1111';
const authSource = 'admin';

const connectionString = `mongodb://${username}:${password}@localhost:27017/${databaseName}?authSource=${authSource}`;

const db = connect(connectionString);

db.createCollection("permissions");

db.permissions.insertMany([{
    "_id": "GENERAL_PERMISSIONS",
    "displayName": "GENERAL SPACE PERMISSIONS",
    "permissions": [
        {
            "_id": "ALLOWS_TO_VIEW_CHANNELS",
            "description": "Allows members to view changes by default (excluding private channels)",
            "displayName": "View channels",
            "position": 0
        },
        {
            "_id": "ALLOWS_TO_MANAGE_CHANNELS",
            "description": "Allows members to create, edit or delete channels",
            "displayName": "Manage channels",
            "position": 1
        },
        {
            "_id": "ALLOWS_TO_MANAGE_CATEGORIES",
            "description": "Allows members to create, edit or delete categories",
            "displayName": "Manage categories",
            "position": 2
        },
        {
            "_id": "ALLOWS_TO_MANAGE_ROLES",
            "description": "Allows members to create new roles and edit or delete roles lower than their highest role. Also allows members to change permissions of individual channels that they have access to",
            "displayName": "Manage roles",
            "position": 3
        },
        {
            "_id": "ALLOWS_TO_MANAGE_SPACE",
            "description": "Allows members to change this server's name, switch regions and add bots to this space",
            "displayName": "Manage space",
            "position": 4
        }
    ],
    "position": 0
},
    {
        "_id": "MEMBERSHIP_PERMISSIONS",
        "displayName": "MEMBERSHIP PERMISSIONS",
        "permissions": [
            {
                "_id": "ALLOWS_TO_CREATE_INVITE",
                "description": "Allows members to invite new people to this space",
                "displayName": "Create invite",
                "position": 0
            }
        ],
        "position": 1
    }]);
