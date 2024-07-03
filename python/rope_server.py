import json
import os
import pathlib
import sys
import traceback
from typing import Any

BUNDLE_DIR = pathlib.Path(__file__).parent.parent / "bundled"

sys.path.insert(0, os.fspath(BUNDLE_DIR))

from rope.base.project import Project
from rope.base import libutils
from rope.refactor.inline import create_inline
from rope.refactor.introduce_parameter import IntroduceParameter

refactorings = {
    "inline": lambda *args: create_inline(*args).get_changes(),
    "introduce_parameter": lambda *args: IntroduceParameter(*args).get_changes("new_param"),
}

def log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)
    with open('rope-server.log', 'a+') as log_file:
        print(message, file=log_file)


def send_output(obj: Any) -> None:
    json.dump(obj, sys.stdout)


def main(project_path: str, configuration: dict) -> None:
    log('Starting main')
    ignored_resources = configuration.get('ignored_resources', [])
    source_folders = configuration.get('source_folders')

    prefs = {'ignored_resources': ignored_resources}
    if source_folders:
        prefs['source_folders'] = source_folders
        
    myproject = Project(project_path, **prefs)
    libutils.analyze_modules(myproject)
    log('Analyzed project, waiting for start signal')
    input()
    send_output({"message": "ready"})
    while True:
        [file, offset] = json.loads(input())
        resource = libutils.path_to_resource(myproject, file)
        output = []
        for name, refactor in refactorings.items():
            try:
                changeset = refactor(myproject, resource, offset)
            except Exception:
                traceback.print_exc()
            else:
                changed_files = []
                for change in changeset.changes:
                    changed_files.append(
                        {
                            "path": change.resource.real_path,
                            "new_contents": change.new_contents,
                        }
                    )

                output.append({"type": name, "changed_files": changed_files})

        send_output(output)


if __name__ == "__main__":
    main(sys.argv[1], json.loads(sys.argv[2]))
