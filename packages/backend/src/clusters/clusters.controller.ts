import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, interval, switchMap, from } from 'rxjs';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { UUID } from 'node:crypto';
import { ClustersService } from './clusters.service.js';
import { GetClusterZodDto } from './dto/get-cluster.dto.js';
import {
  GetClusterLogsQueryZodDto,
  GetClusterLogsZodDto,
} from './dto/get-cluster-logs.dto.js';
import { GetClusterStatsZodDto } from './dto/get-cluster-stats.dto.js';
import { AuthGuard } from '../auth/guards/jwt.guard.js';
import { Readable } from 'node:stream';

@ApiTags('Clusters')
@Controller('clusters')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description:
    'This route is protected by an Authorization header that is either not provided or invalid.',
})
export class ClustersController {
  constructor(private readonly clustersService: ClustersService) {}

  @Get()
  @ApiOkResponse({
    description: 'The list of clusters.',
    type: GetClusterZodDto,
    isArray: true,
  })
  findAll() {
    return this.clustersService.findAll();
  }

  @Sse('stream')
  @ApiOkResponse({
    description: 'A stream of all clusters, emitted every 5 seconds.',
  })
  @ApiProduces('text/event-stream')
  streamAll(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      this.clustersService
        .findAll()
        .then((clusters) => {
          subscriber.next({ data: clusters } as MessageEvent);
        })
        .catch((err) => subscriber.error(err));

      const sub = interval(5000)
        .pipe(switchMap(() => from(this.clustersService.findAll())))
        .subscribe({
          next: (clusters) => {
            subscriber.next({ data: clusters } as MessageEvent);
          },
          error: (err) => subscriber.error(err),
        });

      return () => {
        sub.unsubscribe();
      };
    });
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'The cluster based on the given ID.',
    type: GetClusterZodDto,
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  findOne(@Param('id') id: UUID) {
    return this.clustersService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID has been deleted.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async remove(@Param('id') id: UUID) {
    await this.clustersService.remove(id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID is starting.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async start(@Param('id') id: UUID) {
    await this.clustersService.start(id);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID has been stopped.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async stop(@Param('id') id: UUID) {
    await this.clustersService.stop(id);
  }

  @Post(':id/restart')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The cluster with the given ID is restarting.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async restart(@Param('id') id: UUID) {
    await this.clustersService.restart(id);
  }

  @Get(':id/logs')
  @ApiProduces('text/plain')
  @ApiOkResponse({
    type: GetClusterLogsZodDto,
    description: 'The logs of the cluster.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  async getLogs(
    @Param('id') id: UUID,
    @Query() query: GetClusterLogsQueryZodDto,
  ) {
    return await this.clustersService.logs(
      id,
      query.since ? new Date(query.since) : undefined,
      query.until ? new Date(query.until) : undefined,
      query.tail,
    );
  }

  @Sse(':id/logs/stream')
  @ApiProduces('text/event-stream')
  @UseGuards(AuthGuard)
  streamLogs(@Param('id') id: UUID): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      let stream: Readable | undefined;

      this.clustersService
        .streamLogs(id)
        .then((s) => {
          stream = s;

          stream.on('data', (log: { content: string; stream: string }) => {
            subscriber.next({ data: log } as MessageEvent);
          });

          stream.on('end', () => subscriber.complete());
          stream.on('error', (err) => subscriber.error(err));
        })
        .catch((err) => subscriber.error(err));

      return () => {
        stream?.destroy();
      };
    });
  }

  @Get(':id/stats')
  @ApiOkResponse({
    type: GetClusterStatsZodDto,
    description: 'The stats of the cluster.',
  })
  @ApiNotFoundResponse({
    description: 'The ID points to an unresolved cluster.',
  })
  @ApiBadRequestResponse({
    description:
      'The requested cluster has no bound container or its not running.',
  })
  async getStats(@Param('id') id: UUID) {
    return await this.clustersService.stats(id);
  }
}
