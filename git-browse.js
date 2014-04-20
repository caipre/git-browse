;(function () {
   'use strict';

   $.gitBrowse = {
      api: 'https://api.github.com',

      user: '',
      repo: '',

      commits: {},

      init: function (data) {
         this.user = data.user;
         this.repo = data.repo;

         hljs.configure({
            languages: ['diff'],
         });

         $.ajaxSetup({
            dataType: 'json',
         });

         async.waterfall([
            this.setup.bind(this),
            this.fetch.bind(this),
            this.render.bind(this)
         ], function (err, results) {
            if (err) {
               console.log(err);
            }
         });
      },

      setup: function(callback) {
         async.waterfall([
            (function (callback) {
               $.ajax({ url: [ this.api, 'repos', this.user, this.repo ].join('/') })
                  .done(function (data) { callback(null, data.default_branch); })
                  .fail(function (xhr, status, error) { callback(error.message); });
            }).bind(this),
            (function (default_branch, callback) {
               $.ajax({ url: [ this.api, 'repos', this.user, this.repo, 'git', 'refs', 'heads', default_branch ].join('/') })
                  .done(function (data) { callback(null, data.object.sha); })
                  .fail(function (xhr, status, error) { callback(error.message); })
            }).bind(this),
         ], function (err, head) {
            if (err) {
               console.log(err);
               callback(err);
            }
            else {
               $.gitBrowse.head = head;
               callback(null, head);
            }
         });
      },

      fetch: function (sha, callback) {
         $.ajax({ url: [ this.api, 'repos', this.user, this.repo, 'commits' ].join('/'),
                  data: { sha: sha } })
            .done(function (data, status, xhr) {
               $.gitBrowse.parse(data, callback);
            })
            .fail(this.fail);
      },

      parse: function (commits, callback) {
         var seen_initial_commit = false;

         $.each(commits, function (idx, commit) {
            if (! $.gitBrowse.commits[commit.sha]) {
               $.gitBrowse.commits[commit.sha] = {
                  sha: commit.sha,
                  children: [],
               };
            }

            $.extend($.gitBrowse.commits[commit.sha], {
               date: commit.commit.committer.date,
               message: commit.commit.message,
               parents: commit.parents.map(function (p) {
                     if ($.gitBrowse.commits[p.sha]) {
                        $.gitBrowse.commits[p.sha].children.push($.gitBrowse.commits[commit.sha]);
                        return $.gitBrowse.commits[p.sha];
                     }
                     else {
                        return $.gitBrowse.commits[p.sha] = {
                           sha: p.sha,
                           children: [ $.gitBrowse.commits[commit.sha] ],
                        };
                     }
                  }),
            });

            if (commit.parents.length === 0) {
               seen_initial_commit = true;
               $.gitBrowse.initial = commit.sha;
            }
         });

         if (seen_initial_commit) {
            callback(null, $.gitBrowse.initial);
         } else {
            $('#message').text('Loading repository... read ' + Object.keys($.gitBrowse.commits).length + ' commits');
            $.gitBrowse.fetch(commits[commits.length - 1].sha, callback);
         }
      },

      render: function (sha, callback) {
         $.gitBrowse.commit(sha)
            .done(function (data) {
               window.title = $.gitBrowse.repo + ': ' + $.gitBrowse.commits[sha].message;

               $('#message').text($.gitBrowse.commits[sha].message);

               $('#files').empty().append(function () {
                  return data.files.map(function (file) {
                     return $('<div class="file">').append([
                              $('<span class="filename">')
                                 .text(file.filename),
                              $('<pre>').append(
                                 $('<code>')
                                    .text(file.patch)
                                    .each(function(i, e) { hljs.highlightBlock(e); })
                              )
                           ]);
                  });
               });

               $('#parents, #children').empty().append(function () {
                  return $.gitBrowse.commits[sha][this.id].map(function(commit) {
                     return $('<a>')
                                 .prop('href', '#' + commit.sha)
                                 .append(
                                    $('<li>')
                                       .text(commit.message)
                                       .on('click', function () { $.gitBrowse.render(commit.sha); })
                                 );
                  });
               });
            });
      },

      commit: function (sha) {
         return $.ajax({
               url: [ this.api, 'repos', this.user, this.repo,
                      'commits', sha ].join('/')
            })
            .fail(this.fail);
      },

      fail: function (xhr, status, error) {
         console.error(error.message);
      },
   };
})();
