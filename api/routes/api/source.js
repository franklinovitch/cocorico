var config = require('../../config.json');

var keystone = require('keystone');
var bcrypt = require('bcrypt');

var Source = keystone.list('Source'),
    Like = keystone.list('Like'),
    Bill = keystone.list('Bill');

var BillHelper = require('../../helpers/BillHelper'),
    SourceHelper = require('../../helpers/SourceHelper'),
    LikeHelper = require('../../helpers/LikeHelper');

exports.addLike = LikeHelper.getAddLikeFunc(Source, 'ERROR_SOURCE_NOT_FOUND', 'ERROR_SOURCE_ALREADY_LIKED');

exports.removeLike = LikeHelper.getRemoveLikeFunc(Source);

exports.list = function(req, res)
{
    if (!config.capabilities.source.read)
        return res.status(403).send();

    Bill.model.findById(req.params.billId)
        .exec(function(err, bill)
        {
            if (err)
                return res.apiError('database error', err);

            if (!bill)
                return res.status(404).apiResponse();

            if (!BillHelper.billIsReadable(bill, req))
    			return res.status(403).send();

            Source.model.find({bill : bill})
                .populate('likes')
                .sort('-score')
                .exec(function(err, sources)
                {
                    if (err)
                        return res.apiError('database error', err);

                    for (var source of sources)
                        source.likes = LikeHelper.filterUserLikes(source.likes, req.user);

                    res.apiResponse({ sources : sources });
                });
        });
}

exports.add = function(req, res)
{
    if (!config.capabilities.source.create)
        return res.status(403).send();

    Bill.model.findById(req.body.billId)
        .exec(function(err, bill)
        {
            if (err)
                return res.apiError('database error', err);

            if (!bill)
                return res.status(404).apiResponse();

            if (!BillHelper.billIsReadable(bill, req)
                || bill.status != 'review')
    			return res.status(403).send();

            Source.model.findOne({url: req.body.url, bill: bill})
                .exec(function(err, source)
                {
                    if (err)
                        return res.apiError('database error', err);

                    if (source)
                        return res.status(400).apiResponse({
                            error: 'ERROR_SOURCE_ALREADY_EXISTS'
                        });

                    SourceHelper.fetchURLMeta(
                        decodeURIComponent(req.body.url),
                        (err, meta) => {
                            if (err)
                                return res.apiError('invalid source URL');

                            var newSource = Source.model({
                                title: meta.title,
                                url: meta.url,
                                author: bcrypt.hashSync(req.user.sub, 10),
                                bill: bill.id,
                                description: meta.description,
                                image: meta.image,
                                type: meta.type,
                                latitude: meta.latitude,
                                longitude: meta.longitude
                            });

                            newSource.save((err) => {
                                if (err)
                                    return res.apiError('database error', err);

                                res.apiResponse({ source: newSource });
                            });
                        }
                    );
                });
        });
}
