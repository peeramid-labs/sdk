/**
 * Enum representing different states of a game instance
 * @public
 */
export enum gameStatusEnum {
  /** Game has been created but not opened for registration */
  created = "Game created",
  /** Game is open for player registration */
  open = "Registration open",
  /** Game is in progress */
  started = "In progress",
  /** Game is in its final turn */
  lastTurn = "Playing last turn",
  /** Game is in overtime */
  overtime = "PLaying in overtime",
  /** Game has finished */
  finished = "Finished",
  /** Game was not found */
  notFound = "not found",
}
