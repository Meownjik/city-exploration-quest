/* Loads a quest by id: data/quests/<questId>.js (sets window.QUEST_DATA).
   Classic script injection, so it also works from file://. */
(function (root) {
  'use strict';
  var Q = (root.Quest = root.Quest || {});
  var DIR = 'data/quests/';

  // Raw ?questId= value, or null. Validation happens in loadQuest.
  function questIdFromUrl() {
    try {
      return new URLSearchParams(root.location.search).get('questId');
    } catch {
      return null;
    }
  }

  // Resolves with the packed quest. Rejects on invalid id (no request is made), missing file or mismatch.
  function loadQuest(questId) {
    return new Promise(function (resolve, reject) {
      if (!Q.data.isValidQuestId(questId)) {
        reject(new Error('invalid questId'));
        return;
      }
      root.QUEST_DATA = undefined;
      var script = document.createElement('script');
      script.src = DIR + questId + '.js';
      script.onload = function () {
        var packed = root.QUEST_DATA;
        root.QUEST_DATA = undefined;
        if (!packed || packed.id !== questId) reject(new Error('quest data does not match questId'));
        else resolve(packed);
      };
      script.onerror = function () { reject(new Error('quest file not found')); };
      document.head.appendChild(script);
    });
  }

  Q.loader = { questIdFromUrl: questIdFromUrl, loadQuest: loadQuest };
})(window);
