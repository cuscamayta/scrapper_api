const { Router } = require('express');
const { AuthMiddleware } = require('../middlewares');

module.exports = function({ ScrapperController }) {
    const router = Router();
    router.route("/categories").get(ScrapperController.getCategories);    
    router.route("/teams/").post(ScrapperController.getTeams);
    router.route("/teams/:teamid/players").post(ScrapperController.getPlayers);
    router.route("/teams/:teamid/players/:playerId").post(ScrapperController.getPlayerDetail);
    router.route("/teams/detail").post(ScrapperController.getTeamDetail);
    // router.route("/:commentId/unique").get(ScrapperController.get);
    router.route("/:ideaId").get(ScrapperController.getIdeaComments);
    router.route("/:ideaId").post(AuthMiddleware, ScrapperController.createdComment);
    router.route("/:commentId").patch(AuthMiddleware, ScrapperController.update);
    router.route("/:commentId").delete(AuthMiddleware, ScrapperController.delete);

    return router;
}