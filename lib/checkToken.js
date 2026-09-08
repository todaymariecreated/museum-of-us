// One place that decides "does this caller have edit rights to this
// museum?" — a plain string comparison against the row's edit_token.
// Every mutating route calls this before writing anything.
function tokenMatches(museum, suppliedToken) {
  return !!suppliedToken && !!museum.edit_token && suppliedToken === museum.edit_token;
}

module.exports = { tokenMatches };
