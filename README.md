# INFS3201-Project-Group1
our project enhance learning a new language by connecting language learners with native speakers around the world and facilitating real-time interactions through text messaging.
The platform serve the following services:
1- User Registration and Profile Setup
   Users are able to set up profiles, upload a profile photo, go through an email verification process before their accounts can be used, reset their passwords.
2- Learning Contacts
   Each user will have a contact list containing other users they would like to communicate with, users can add or remove contacts,view the profiles of other users and initiate    communication with them. Users cannot add other users who have blocked them.
3- Messaging
   Only plain text messages are supported; handling images or HTML content is not supported.
4- Badges
   The system will support 'badges' that appear on users' profiles and are visible to all.
  Badges are made available for users who achieve the following:
o First Conversation: Message sent and a reply received.
o 100 Messages Sent: Total messages sent reaches 100.
5- Blocking
   Our system provides the ability to block other users. Once a user has been blocked, that user will no longer be able to contact the blocker or see their profile.


Technologies Used:
Node.js, Express.js, and MongoDB. 

Email Messages:
Since we do not have an actual email server, we've simulated sending emails by outputting the email content using
console.log().

Security:
We are using coockies, sessions, password hashing, protection against Cross-Site Request Forgery (CSRF).
