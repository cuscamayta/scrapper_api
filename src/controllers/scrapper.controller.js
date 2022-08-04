let _scrapperService = null;

class CommentController {

    constructor({ ScrapperService }) {
        _scrapperService = ScrapperService;
    }

    async getCategories(req, res) {
        var categories = await _scrapperService.getCategories();

        return res.json(categories);
    }

    async getTeams(req, res) {
        const { seasonId, typeId, competitionId, groupId, matchId } = req.body;
        const teams = await _scrapperService.getTeams(seasonId, typeId, competitionId, groupId, matchId);
        return res.json(teams);
    }

    async getPlayers(req, res) {
        return await _scrapperService.getPlayers();
    }

    async getPlayerDetail(req, res) {
        const { playerid } = req.params;
        return await _scrapperService.getPlayerDetail(playerid);
    }

    async getClubDetail(req, res) {
        const { clubId } = req.params;
        return await _scrapperService.getClubDetail(clubId);
    }

    async getTeamDetail(req, res) {        
        const teamDetail =  await _scrapperService.getTeamDetail(req.body);
        return res.json(teamDetail);
    }

    async get(req, res) {
        var categories = _scrapperService.getCategories();

        return res.send({ title: 'title', categories: categories });
    }

    async update(req, res) {
        const { body } = req;
        const { commentId } = req.params;
        const updateComment = await _commentService.update(commentId, body);
        return res.send(updateComment);
    }

    async delete(req, res) {
        const { commentId } = req.params;
        const commentUser = await _commentService.delete(commentId);
        return res.send(commentUser);
    }

    async getIdeaComments(req, res) {
        const { ideaId } = req.params;
        const comments = await _commentService.getIdeaComments(ideaId);
        return res.send(comments);
    }

    async createdComment(req, res) {
        const { body } = req;
        const { ideaId } = req.params;
        const { id: userId } = req.user;
        const comment = await _commentService.createdComment(body, ideaId, userId);
        return res.status(201).send(comment);
    }

}

module.exports = CommentController;