import json
import sys

from rope.base.project import Project
from rope.base import libutils
from rope.refactor.inline import create_inline


def main(project_path: str, resource_path: str, offset: int):

    myproject = Project(project_path)
    resource = libutils.path_to_resource(myproject, resource_path)
    myproject.validate(resource)

    inline = create_inline(myproject, resource, offset)
    changes = inline.get_changes()

    output = []
    for change in changes.changes:
        output.append({
            'path': change.resource.real_path,
            'new_contents': change.new_contents,
        })

    json.dump(output, sys.stdout)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]))
