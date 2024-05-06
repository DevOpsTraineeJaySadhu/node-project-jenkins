const customMessages = {
  custom_message: { code: 200, message: 'custom message' },
  already_exists_email: { code: 409, message: 'User already exists with email id' },
  user_not_found: { code: 404, message: "Sorry, we didn't find any account with that Email id/Mobile number" },
  insufficient_chips: { code: 406, message: 'You have insufficient balance' },
  table_proto_not_found: { code: 404, message: 'table not found!' },
  already_exists_mobile: { code: 409, message: 'User already exists with this mobile number' },
  max_board_join_limit: { code: 419, message: 'You can not join more than 3 board' },
  wait_for_turn: { code: 419, message: 'Please wait for your turn' },
  no_player_found: { code: 409, message: 'No playing player found Try after some time' },
  invalid_code: { code: 401, message: 'Invalid code or board has been started already !' },
  can_not_join_board: { code: 401, message: 'can not join board.' },
  power_up_used: { code: 403, message: 'you have already used this powerup.' },
  image_allowed: { code: 419, message: 'Only .png Image are allowed' },
};
/**
 * Push notification messages
 */
const notifications = {};

const builder = {
  invalid_req: prefix => builder.prepare(406, prefix, 'invalid Request'),
  wrong_otp: prefix => builder.prepare(403, prefix, 'entered OTP is invalid'),
  wrong_format: prefix => builder.prepare(403, prefix, 'wrong format'),
  server_error: prefix => builder.prepare(500, prefix, 'server error'),
  server_maintenance: prefix => builder.prepare(500, prefix, 'maintenance mode is active'),
  unauthorized: prefix => builder.prepare(401, prefix, 'authentication Error, please try logging again'),
  inactive: prefix => builder.prepare(403, prefix, 'inactive'),
  not_found: prefix => builder.prepare(404, prefix, 'not found'),
  not_matched: prefix => builder.prepare(406, prefix, 'not matched'),
  not_verified: prefix => builder.prepare(406, prefix, 'not verified'),
  already_exists: prefix => builder.prepare(409, prefix, 'already exists'),
  user_deleted: prefix => builder.prepare(406, prefix, 'deleted by admin'),
  user_blocked: prefix => builder.prepare(406, prefix, 'blocked by admin'),
  required_field: prefix => builder.prepare(419, prefix, 'field required'),
  too_many_request: prefix => builder.prepare(429, prefix, 'too many request'),
  expired: prefix => builder.prepare(417, prefix, 'expired'),
  canceled: prefix => builder.prepare(419, prefix, 'canceled'),
  created: prefix => builder.prepare(200, prefix, 'created'),
  updated: prefix => builder.prepare(200, prefix, 'updated'),
  deleted: prefix => builder.prepare(417, prefix, 'deleted'),
  blocked: prefix => builder.prepare(401, prefix, 'blocked'),
  success: prefix => builder.prepare(200, prefix, 'success'),
  successfully: prefix => builder.prepare(200, prefix, 'successfully'),
  error: prefix => builder.prepare(500, prefix, 'error'),
  no_prefix: prefix => builder.prepare(200, prefix, ''),
  custom: { ...customMessages },
  getString: key => (customMessages ? customMessages[key].message : ''),
  // custom: key => builder.prepare(...customMessages[key], ''),
  notifications,
};

Object.defineProperty(builder, 'prepare', {
  enumerable: false,
  configurable: false,
  writable: false,
  value: (code, prefix, message) => ({
    code,
    message: `${prefix ? `${prefix} ${message}` : message}`,
  }),
});

module.exports = builder;
